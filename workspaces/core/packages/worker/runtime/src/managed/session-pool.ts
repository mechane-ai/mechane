import { SessionFailed } from '@earendil-works/pi-durable';
import { capturePromise, serialCalls } from '@mechane/utilities';
import type { ManagedAgentEngine } from './engine.ts';
import { createSessionObserver } from './session-observer.ts';
import type { SessionObserver } from './session-observer.ts';
import type { ManagedSessionReader } from './session-reader.ts';
import type { openManagedSessionIndex } from './store/session-index.ts';
import { sessionMissing } from './store/session-index.ts';

const IDLE_CAPACITY = 8;
type Index = ReturnType<typeof openManagedSessionIndex>;

export type SessionRoute = {
  readonly id: string;
  readonly publicId: string;
  readonly origin: string | null;
  readonly canCreate: boolean;
  readonly isWrite: boolean;
  readonly isStream?: boolean;
  readonly terminal?: { readonly receipt: string | null; readonly result: unknown };
};

type EngineStart = { readonly id: string; readonly wake: () => void };

type PoolOptions = {
  readonly index: Index;
  readonly waitUntil: (pending: Promise<unknown>) => void;
  readonly start: (options: EngineStart) => Promise<ManagedAgentEngine>;
  readonly openReader: (id: string) => Promise<ManagedSessionReader & { readonly close: () => Promise<void> }>;
  readonly erase: (id: string) => Promise<void>;
};

type ReadView = {
  readonly observe: SessionObserver;
  readonly reader: ManagedSessionReader;
  readonly source: EventTarget;
  readonly signal: AbortSignal;
  readonly onStreamClose: () => void;
};

type Operation = {
  readonly read: (view: ReadView) => Promise<Response>;
  readonly write: (engine: ManagedAgentEngine) => Promise<Response>;
};

export function openManagedSessionPool({ index, waitUntil, start, openReader, erase }: PoolOptions) {
  type SessionHandle = ReturnType<typeof createHandle>;

  const idle = new Set<string>();
  const active = new Map<string, SessionHandle>();

  function createHandle(id: string) {
    const calls = serialCalls();
    const source = new EventTarget();
    const retired = new AbortController();
    const cached: { engine?: ManagedAgentEngine } = {};
    const observer = createSessionObserver(readObserved);
    let users = 0;
    let streams = 0;
    let generation = 0;
    let isPumpScheduled = false;

    async function open() {
      const current = generation;

      function wake() {
        if (retired.signal.aborted || current !== generation) {
          return;
        }

        idle.delete(id);
        source.dispatchEvent(new Event('change'));
        waitUntil(index.wake(id));
      }

      if (cached.engine === undefined) {
        cached.engine = await start({ id, wake });

        await observer.open(cached.engine);
      }

      return cached.engine;
    }

    async function close() {
      generation += 1;

      observer.close();

      try {
        await cached.engine?.close();
      } finally {
        delete cached.engine;
      }
    }

    async function serialize<T>(operation: () => Promise<T>) {
      users += 1;

      const pending = calls.run({
        run: async () => {
          try {
            return await operation();
          } catch (failure) {
            if (failure instanceof SessionFailed && cached.engine !== undefined) {
              await index.wake(id);
              await close();
            }

            throw failure;
          }
        },
      });

      waitUntil(capturePromise({ promise: pending }));

      try {
        return await pending;
      } finally {
        users -= 1;

        removeIfUnused();
      }
    }

    function removeIfUnused() {
      if (users === 0 && cached.engine === undefined && streams === 0) {
        active.delete(id);
      }
    }

    async function withReader<T>(operation: (reader: ManagedSessionReader) => Promise<T>) {
      if (retired.signal.aborted) {
        return sessionMissing();
      }

      if (cached.engine !== undefined) {
        return await operation(cached.engine);
      }

      const reader = await openReader(id);

      try {
        return await operation(reader);
      } finally {
        await reader.close();
      }
    }

    async function readObserved<T>(operation: (reader: ManagedSessionReader) => Promise<T>) {
      if (active.get(id)?.observe !== observer.observe) {
        return sessionMissing();
      }

      return await serialize(() => withReader(operation));
    }

    function schedule() {
      if (!isPumpScheduled && !retired.signal.aborted) {
        isPumpScheduled = true;

        waitUntil(pump(id));
      }
    }

    function beginPump() {
      isPumpScheduled = false;
    }

    function holdStream(isStream: boolean) {
      let isHeld = isStream;

      if (isHeld) {
        streams += 1;
      }

      return () => {
        if (!isHeld) {
          return;
        }

        isHeld = false;
        streams -= 1;

        if (cached.engine === undefined) {
          removeIfUnused();
        } else if (streams === 0) {
          schedule();
        }
      };
    }

    return {
      observe: observer.observe,
      withReader,
      serialize,
      open,
      close,
      source,
      retired,
      holdStream,
      schedule,
      beginPump,
      get canCache() {
        return cached.engine !== undefined && streams === 0 && !retired.signal.aborted;
      },
      get canEvict() {
        return streams === 0 && !isPumpScheduled && cached.engine?.harness.wake().active !== true;
      },
    };
  }

  async function use<T>(id: string, operation: (handle: SessionHandle) => Promise<T>) {
    const handle = active.get(id) ?? createHandle(id);

    active.set(id, handle);

    return await handle.serialize(() => operation(handle));
  }

  function rememberIdle(id: string, handle: SessionHandle) {
    if (!handle.canCache) {
      return;
    }

    idle.delete(id);
    idle.add(id);

    if (idle.size <= IDLE_CAPACITY) {
      return;
    }

    const oldest = idle.values().next().value;

    if (oldest === undefined) {
      return;
    }

    idle.delete(oldest);
    waitUntil(
      use(oldest, async (candidate) => {
        const row = await index.read(oldest);

        if (row?.state === 'live' && row.at === null && candidate.canEvict) {
          await candidate.close();
        }
      }),
    );
  }

  async function retire(id: string, handle: SessionHandle) {
    handle.retired.abort();
    idle.delete(id);
    await handle.close();
    await erase(id);
    await index.erased(id);
  }

  async function pump(id: string) {
    await use(id, async (handle) => {
      handle.beginPump();

      const row = await index.read(id);

      if (row === undefined || row.state === 'erased') {
        return;
      }

      if (row.state === 'sealed') {
        return await retire(id, handle);
      }

      const owner = await handle.open();
      const at = await owner.pump();

      handle.source.dispatchEvent(new Event('change'));

      const after = await index.read(id);

      if (after?.state === 'sealed') {
        return await retire(id, handle);
      }

      const isIdle = at === null && after?.revision === row.revision;

      if (isIdle && (await owner.canPark())) {
        await handle.close();
        await index.finish(id, row.revision, null);

        return;
      }

      await index.finish(id, row.revision, at);

      if (at === null) {
        rememberIdle(id, handle);
      }
    });
  }

  async function run(route: SessionRoute, signal: AbortSignal, operation: Operation) {
    return await use(route.id, async (handle) => {
      const row = await index.admit(route);

      if (row.state !== 'live') {
        if (row.state === 'sealed') {
          await retire(route.id, handle);
        }

        if (route.terminal !== undefined && route.terminal.receipt === row.receipt) {
          return Response.json(route.terminal.result);
        }

        return sessionMissing();
      }

      idle.delete(route.id);

      const onStreamClose = handle.holdStream(route.isStream === true);

      try {
        if (route.isWrite) {
          return await operation.write(await handle.open());
        }

        return await handle.withReader(
          async (reader) =>
            await operation.read({
              reader,
              observe: handle.observe,
              source: handle.source,
              signal: AbortSignal.any([signal, handle.retired.signal]),
              onStreamClose,
            }),
        );
      } catch (failure) {
        onStreamClose();

        throw failure;
      } finally {
        const after = await index.read(route.id);

        if (after?.state === 'sealed') {
          await retire(route.id, handle);
        } else if (route.isWrite) {
          handle.schedule();
        } else if (after?.at === null) {
          rememberIdle(route.id, handle);
        }
      }
    });
  }

  async function alarm() {
    const ids = await index.due();
    const results = await Promise.allSettled(ids.map(pump));
    const failure = results.find((result) => result.status === 'rejected');

    if (failure !== undefined) {
      throw failure.reason;
    }
  }

  return { run, alarm };
}
