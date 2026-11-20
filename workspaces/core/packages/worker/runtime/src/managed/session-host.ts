import { SessionFailed } from '@earendil-works/pi-durable';
import { createAgentSlotClient, managedSessionName, SESSION_SLOT_WAKE_URL } from '@mechane/agent-slot';
import { openControlStore } from '@mechane/control-store';
import type { ControlStore } from '@mechane/control-store';
import { HttpMethod, HttpStatusCode } from '@mechane/records';
import { capturePromise, serialCalls } from '@mechane/utilities';
import { Redacted, Schema } from 'effect';
import { ownsSessionAddress } from '../actor/identity.ts';
import { fingerprint } from '../actor/state.ts';
import type { InstalledWorkerScheduler, RuntimeBindings } from '../actor/types.ts';
import { loadRuntimeConfiguration, resolveRuntimeEnvironment } from '../config.ts';
import { writeActorOperationFailure } from '../output/write-actor-diagnostic.ts';
import { createManagedAgentRuntime } from './client.ts';
import { startManagedSessionEngine } from './engine.ts';
import type { ManagedAgentEngine } from './engine.ts';
import { failManagedRequest, ManagedRuntimeError, ManagedRuntimeFailureWire } from './failure.ts';
import { managedActorUrl } from './identity.ts';
import { runManagedOperation } from './operations.ts';
import { ManagedAgentScope } from './protocol.ts';
import type { ManagedSessionMutation } from './protocol.ts';
import { runManagedReadOperation } from './read-operations.ts';
import { createSessionObserver } from './session-observer.ts';
import { openManagedSessionReader } from './session-reader.ts';
import type { ManagedSessionReader } from './session-reader.ts';
import { managedSessionRoute } from './session-route.ts';
import { openManagedSessionMeta, sessionMissing } from './store/session-meta.ts';
import type { SessionMeta } from './store/session-meta.ts';

const INTERNAL_FAILURE_MESSAGE = 'The managed agent operation could not finish';

const ManagedEnvelope = Schema.Struct({
  scope: ManagedAgentScope,
  method: Schema.NonEmptyString,
  input: Schema.Unknown,
});

type RuntimeServices = {
  readonly configuration: ReturnType<typeof loadRuntimeConfiguration>;
  readonly withControl: <T>(operation: (store: ControlStore) => Promise<T>) => Promise<T>;
  readonly wakeInstalledSession: ReturnType<InstalledWorkerScheduler>;
};

/** Single-session Durable Object host owning one unprefixed native `pi-durable` Harness. */
export function openManagedSessionHost(
  state: DurableObjectState,
  bindings: RuntimeBindings,
  scheduleInstalled: InstalledWorkerScheduler,
) {
  const metaStore = openManagedSessionMeta(state.storage);
  const calls = serialCalls();
  const source = new EventTarget();
  const slotWakes = new EventTarget();
  const retired = new AbortController();
  const instanceId = crypto.randomUUID();

  const cached: { engine?: ManagedAgentEngine; services?: Promise<RuntimeServices>; hasRecoveredSlot: boolean } = {
    hasRecoveredSlot: false,
  };

  const counters = { streams: 0, generation: 0, isPumpScheduled: false };
  const observer = createSessionObserver(readObserved);

  function slotClient(scope: ManagedAgentScope) {
    return createAgentSlotClient({ namespace: bindings.AGENT_SLOTS, scope });
  }

  function scopedDelegate(scope: ManagedAgentScope) {
    return function delegate(agentId: string) {
      return createManagedAgentRuntime(bindings.SESSIONS, { workspaceId: scope.workspaceId, agentId });
    };
  }

  async function initializeServices(): Promise<RuntimeServices> {
    async function loadConfiguration(): Promise<ReturnType<typeof loadRuntimeConfiguration>> {
      try {
        const environment = await resolveRuntimeEnvironment({ environment: bindings });

        return loadRuntimeConfiguration({ environment });
      } catch (failure) {
        delete cached.services;

        throw failure;
      }
    }

    const configuration = await loadConfiguration();

    async function withControl<T>(operation: (store: ControlStore) => Promise<T>): Promise<T> {
      const store = await openControlStore({
        databaseUrl: Redacted.value(configuration.databaseUrl),
        keyring: Redacted.value(configuration.credentialKeyring),
        maxConnections: configuration.maxConnections,
      });

      try {
        return await operation(store);
      } finally {
        await store.close();
      }
    }

    const wakeInstalledSession = scheduleInstalled({ configuration, sessions: bindings.SESSIONS, execution: state });

    return { configuration, withControl, wakeInstalledSession };
  }

  async function loadServices(): Promise<RuntimeServices> {
    cached.services ??= initializeServices();

    return await cached.services;
  }

  async function openEngine(meta: SessionMeta): Promise<ManagedAgentEngine> {
    const currentGeneration = counters.generation;

    function wake(): void {
      if (retired.signal.aborted || currentGeneration !== counters.generation) {
        return;
      }

      source.dispatchEvent(new Event('change'));
      state.waitUntil(metaStore.wake());
    }

    if (cached.engine === undefined) {
      const services = await loadServices();
      const slots = slotClient(meta.scope);

      if (!cached.hasRecoveredSlot) {
        await slots.recoverInstance(meta.id, instanceId);

        cached.hasRecoveredSlot = true;
      }

      const doName = managedSessionName({ workspaceId: meta.scope.workspaceId, id: meta.id });

      cached.engine = await startManagedSessionEngine({
        storage: await metaStore.openStorage(),
        scope: meta.scope,
        configuration: services.configuration,
        withControl: services.withControl,
        wakeInstalledSession: services.wakeInstalledSession,
        waitUntil: (pending: Promise<void>) => state.waitUntil(pending),
        wake,
        identitySlot: slots.forSession({
          holderId: meta.id,
          sessionId: meta.publicId,
          doName,
          instanceId,
          wakes: slotWakes,
        }),
        sealErasure: async (target: string, mutation?: ManagedSessionMutation) => {
          if (target !== meta.id) {
            throw new Error('Managed session erasure crossed an execution boundary');
          }

          if (mutation === undefined) {
            await metaStore.seal(null);

            return;
          }

          await metaStore.seal(await fingerprint(mutation));
        },
        delegate: scopedDelegate(meta.scope),
      });

      await observer.open(cached.engine);
    }

    return cached.engine;
  }

  async function closeEngine(): Promise<void> {
    counters.generation += 1;

    observer.close();

    try {
      await cached.engine?.close();
    } finally {
      delete cached.engine;
    }
  }

  async function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const pending = calls.run({
      run: async () => {
        try {
          return await operation();
        } catch (failure) {
          if (failure instanceof SessionFailed && cached.engine !== undefined) {
            await metaStore.wake();
            await closeEngine();
          }

          throw failure;
        }
      },
    });

    state.waitUntil(capturePromise({ promise: pending }));

    return await pending;
  }

  async function withReader<T>(meta: SessionMeta, operation: (reader: ManagedSessionReader) => Promise<T>): Promise<T> {
    if (retired.signal.aborted) {
      return sessionMissing();
    }

    if (cached.engine !== undefined) {
      return await operation(cached.engine);
    }

    const services = await loadServices();

    const reader = openManagedSessionReader({
      storage: await metaStore.openStorage(),
      workspaceId: meta.scope.workspaceId,
      withControl: services.withControl,
    });

    try {
      return await operation(reader);
    } finally {
      await reader.close();
    }
  }

  async function readObserved<T>(operation: (reader: ManagedSessionReader) => Promise<T>): Promise<T> {
    return await serialize(async () => {
      const meta = await metaStore.read();

      if (meta === undefined || meta.state !== 'live') {
        return sessionMissing();
      }

      return await withReader(meta, operation);
    });
  }

  async function retire(meta: SessionMeta): Promise<void> {
    retired.abort();
    await closeEngine();
    await slotClient(meta.scope).remove(meta.id);
    await metaStore.erase();
  }

  async function pump(): Promise<void> {
    await serialize(async () => {
      counters.isPumpScheduled = false;

      const row = await metaStore.read();

      if (row === undefined || row.state === 'erased') {
        return;
      }

      if (row.state === 'sealed') {
        await retire(row);

        return;
      }

      const owner = await openEngine(row);
      const at = await owner.pump();

      source.dispatchEvent(new Event('change'));

      const after = await metaStore.read();

      if (after?.state === 'sealed') {
        await retire(after);

        return;
      }

      const isIdle = at === null && after?.revision === row.revision;

      if (isIdle && (await owner.canPark())) {
        await closeEngine();
        await metaStore.finish(row.revision, null);

        return;
      }

      await metaStore.finish(row.revision, at);
    });
  }

  function schedulePump(): void {
    if (!counters.isPumpScheduled && !retired.signal.aborted) {
      counters.isPumpScheduled = true;

      state.waitUntil(pump());
    }
  }

  function holdStream(isStream: boolean): () => void {
    const held = { active: isStream };

    if (held.active) {
      counters.streams += 1;
    }

    return () => {
      if (!held.active) {
        return;
      }

      held.active = false;
      counters.streams -= 1;

      if (cached.engine !== undefined && counters.streams === 0) {
        schedulePump();
      }
    };
  }

  async function fetch(request: Request): Promise<Response> {
    if (request.url === SESSION_SLOT_WAKE_URL && request.method === HttpMethod.Post) {
      slotWakes.dispatchEvent(new Event('wake'));

      if (cached.engine === undefined) {
        schedulePump();
      }

      return new Response(null, { status: HttpStatusCode.NoContent });
    }

    if (request.url !== managedActorUrl || request.method !== HttpMethod.Post) {
      return new Response(null, { status: HttpStatusCode.NotFound });
    }

    try {
      const decoded = Schema.decodeUnknownResult(ManagedEnvelope)(await request.json());

      if (decoded._tag === 'Failure') {
        return failManagedRequest(HttpStatusCode.BadRequest, 'Invalid managed agent operation');
      }

      const { scope, method, input } = decoded.success;
      const route = await managedSessionRoute(scope, method, input);
      const addressName = managedSessionName({ workspaceId: scope.workspaceId, id: route.id });

      if (!ownsSessionAddress({ state, bindings, name: addressName })) {
        return sessionMissing();
      }

      return await serialize(async () => {
        const { row, isCreated } = await metaStore.admit({ scope, route });

        if (isCreated) {
          cached.hasRecoveredSlot = true;
        }

        if (row.state !== 'live') {
          if (row.state === 'sealed') {
            await retire(row);
          }

          if (route.terminal !== undefined && route.terminal.receipt === row.receipt) {
            return Response.json(route.terminal.result);
          }

          return sessionMissing();
        }

        const onStreamClose = holdStream(route.isStream === true);

        try {
          if (route.isWrite) {
            const engine = await openEngine(row);

            return await runManagedOperation({ scope, method, input, engine });
          }

          return await withReader(
            row,
            async (reader) =>
              await runManagedReadOperation({
                scope,
                method,
                input,
                delegate: scopedDelegate(scope),
                reader,
                observe: observer.observe,
                source,
                signal: AbortSignal.any([request.signal, retired.signal]),
                onStreamClose,
              }),
          );
        } catch (failure) {
          onStreamClose();

          throw failure;
        } finally {
          const after = await metaStore.read();

          if (after?.state === 'sealed') {
            await retire(after);
          } else if (route.isWrite) {
            schedulePump();
          }
        }
      });
    } catch (failure) {
      if (failure instanceof ManagedRuntimeError) {
        return Response.json(Schema.encodeSync(ManagedRuntimeFailureWire)(failure), { status: failure.status });
      }

      writeActorOperationFailure(failure);

      const safe = new ManagedRuntimeError({
        status: HttpStatusCode.InternalServerError,
        reason: INTERNAL_FAILURE_MESSAGE,
      });

      return Response.json(Schema.encodeSync(ManagedRuntimeFailureWire)(safe), { status: safe.status });
    }
  }

  async function alarm(): Promise<void> {
    const row = await metaStore.due();

    if (row !== null) {
      await pump();
    }
  }

  return { fetch, alarm };
}
