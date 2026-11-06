import { serialCalls } from '@mechane/utilities';
import type { SQLiteDriver } from '@tanstack/db-sqlite-persistence-core';
import { Duration, Result, Schema } from 'effect';
import type { Types } from 'effect';
import { StoreCommand, StoreFailed, StoreReply, StoreRequest, StoreRows, StoreTransactionId } from './protocol';

type OpenConnectionInput = {
  readonly command: StoreCommand;
  readonly signal: AbortSignal;
  readonly onFailure: (failure: unknown) => void;
};

/** Owns one worker connection and the native persistence driver it serves. */
export type StoreConnection = {
  readonly driver: SQLiteDriver;
  readonly initialValue: unknown;
  readonly close: () => Promise<void>;
  readonly terminate: () => void;
};

type ConnectionState = { readonly nextRequestId: number; readonly isClosed: boolean; readonly failure: unknown };

const REQUEST_TIMEOUT_MS = Duration.toMillis('10 seconds');
const CLOSE_TIMEOUT_MS = Duration.toMillis('1 second');

/** Starts one worker whose lifetime ends when its signal aborts or its owner closes it. */
export async function openConnection({
  command: initialCommand,
  signal,
  onFailure,
}: OpenConnectionInput): Promise<StoreConnection> {
  const worker = new Worker(new URL('worker/main.ts', import.meta.url), { type: 'module' });
  const ready = Promise.withResolvers<void>();
  const stopped = new AbortController();
  const pending = new Map<number, PromiseWithResolvers<unknown>>();
  const state: Types.Mutable<ConnectionState> = { nextRequestId: 0, isClosed: false, failure: undefined };
  const encodeRequest = Schema.encodeSync(StoreRequest);
  const decodeReply = Schema.decodeUnknownResult(StoreReply, { onExcessProperty: 'error' });
  const decodeRows = Schema.decodeUnknownResult(StoreRows, { onExcessProperty: 'error' });
  const databaseCalls = serialCalls();

  function terminate(failure: unknown): void {
    if (state.isClosed) {
      return;
    }

    state.isClosed = true;
    state.failure = failure;

    worker.terminate();
    stopped.abort(failure);
    signal.removeEventListener('abort', abort);
    ready.reject(failure);

    for (const waiter of pending.values()) {
      waiter.reject(failure);
    }

    pending.clear();
  }

  function fail(failure: unknown): void {
    if (state.isClosed) {
      return;
    }

    terminate(failure);
    onFailure(failure);
  }

  function abort(): void {
    const failure: unknown = signal.reason;

    terminate(failure);
  }

  worker.addEventListener('message', (event: MessageEvent<unknown>) => {
    const decoded = decodeReply(event.data);

    if (Result.isFailure(decoded)) {
      const failure = new StoreFailed({ reason: String(decoded.failure) });

      fail(failure);

      return;
    }

    StoreReply.match(decoded.success, {
      Ready: () => ready.resolve(),
      Fatal: ({ reason }) => {
        const failure = new StoreFailed({ reason });

        fail(failure);
      },
      Failed: ({ requestId, reason }) => {
        const failure = new StoreFailed({ reason });
        const waiter = pending.get(requestId);

        pending.delete(requestId);
        waiter?.reject(failure);
      },
      Completed: ({ requestId, value }) => {
        const waiter = pending.get(requestId);

        pending.delete(requestId);
        waiter?.resolve(value);
      },
    });
  });

  worker.addEventListener('error', (event) => {
    const failure = new StoreFailed({ reason: event.message });

    fail(failure);
  });

  worker.addEventListener('messageerror', () => {
    const failure = new StoreFailed({ reason: 'Worker response could not be read' });

    fail(failure);
  });

  async function request(command: StoreCommand, timeoutMs = REQUEST_TIMEOUT_MS): Promise<unknown> {
    if (state.isClosed) {
      throw state.failure;
    }

    state.nextRequestId += 1;

    const requestId = state.nextRequestId;
    const waiter = Promise.withResolvers<unknown>();
    const envelope: StoreRequest = { requestId, command };

    const timer = setTimeout(() => {
      const failure = new StoreFailed({ reason: 'Database request timed out' });

      fail(failure);
    }, timeoutMs);

    pending.set(requestId, waiter);

    try {
      try {
        const encoded = encodeRequest(envelope);

        worker.postMessage(encoded, { transfer: [] });
      } catch (failure) {
        fail(failure);

        throw failure;
      }

      return await waiter.promise;
    } finally {
      clearTimeout(timer);
      pending.delete(requestId);
    }
  }

  async function runSerial<A>(calls: ReturnType<typeof serialCalls>, run: () => Promise<A>): Promise<A> {
    const cancelled = Promise.withResolvers<never>();

    function cancel(): void {
      cancelled.reject(state.failure);
    }

    stopped.signal.addEventListener('abort', cancel, { once: true });

    if (state.isClosed) {
      cancel();
    }

    const timer = setTimeout(() => {
      const failure = new StoreFailed({ reason: 'Database operation timed out' });

      fail(failure);
    }, REQUEST_TIMEOUT_MS);

    const operation = calls.run({
      run: async () => {
        if (state.isClosed) {
          throw state.failure;
        }

        return await run();
      },
    });

    try {
      return await Promise.race([operation, cancelled.promise]);
    } finally {
      clearTimeout(timer);
      stopped.signal.removeEventListener('abort', cancel);
    }
  }

  function makeOperations(
    transactionId: StoreTransactionId | null,
    calls: ReturnType<typeof serialCalls>,
  ): Pick<SQLiteDriver, 'exec' | 'query' | 'run'> {
    return {
      async exec(sql) {
        const command = StoreCommand.cases.Exec.make({ transactionId, sql });

        await runSerial(calls, async () => await request(command));
      },
      // The public SQLiteDriver interface requires this type parameter.
      // ast-grep-ignore: return-only-type-parameter
      async query<T>(sql: string, params: ReadonlyArray<unknown> = []): Promise<ReadonlyArray<T>> {
        const command = StoreCommand.cases.Query.make({ transactionId, sql, params });
        const value = await runSerial(calls, async () => await request(command));
        const decoded = decodeRows(value);

        if (Result.isFailure(decoded)) {
          const failure = new StoreFailed({ reason: String(decoded.failure) });

          fail(failure);

          throw failure;
        }

        // oxlint-disable-next-line consistent-type-assertions, no-unsafe-type-assertion -- SQLiteDriver lacks schema
        return decoded.success as ReadonlyArray<T>;
      },
      async run(sql, params = []) {
        const command = StoreCommand.cases.Run.make({ transactionId, sql, params });

        await runSerial(calls, async () => await request(command));
      },
    };
  }

  // Turso's statement preparation also touches the connection, before its native async lock is acquired.
  const databaseOperations = makeOperations(null, databaseCalls);

  const driver: SQLiteDriver = {
    ...databaseOperations,
    async transaction(callback) {
      return await runSerial(databaseCalls, async () => {
        const nextTransactionId = StoreTransactionId.make(crypto.randomUUID());
        const begin = StoreCommand.cases.Begin.make({ transactionId: nextTransactionId });
        const operations = makeOperations(nextTransactionId, serialCalls());

        const transactionDriver: SQLiteDriver = {
          ...operations,
          async transaction() {
            throw new StoreFailed({ reason: 'Nested transactions are not supported' });
          },
        };

        await request(begin);

        async function mutate() {
          try {
            return await callback(transactionDriver);
          } catch (failure) {
            if (!state.isClosed) {
              const rollback = StoreCommand.cases.Rollback.make({ transactionId: nextTransactionId });

              try {
                await request(rollback);
              } catch (rollbackFailure) {
                fail(rollbackFailure);
              }
            }

            throw failure;
          }
        }

        const value = await mutate();
        const commit = StoreCommand.cases.Commit.make({ transactionId: nextTransactionId });

        await request(commit);

        return value;
      });
    },
  };

  signal.addEventListener('abort', abort, { once: true });

  if (signal.aborted) {
    abort();
  }

  async function initialize(): Promise<unknown> {
    try {
      await ready.promise;

      return await request(initialCommand);
    } catch (failure) {
      terminate(failure);

      throw failure;
    }
  }

  const initialValue = await initialize();

  return {
    driver,
    initialValue,
    async close() {
      try {
        if (!state.isClosed) {
          const command = StoreCommand.cases.Close.make({});

          await request(command, CLOSE_TIMEOUT_MS);
        }
      } finally {
        const failure = new StoreFailed({ reason: 'Database connection is closed' });

        terminate(failure);
      }
    },
    terminate() {
      const failure = new StoreFailed({ reason: 'Database connection is closed' });

      terminate(failure);
    },
  };
}
