import { Bytes } from '@mechane/records';
import type { Database, Transaction } from '@tursodatabase/database-wasm/vite';
import { DateTime, Duration, Result, Schema } from 'effect';
import type { Types } from 'effect';
import { StoreCommand, StoreFailed, StoreReply, StoreRequest } from '../protocol';
import type { StoreTransactionId } from '../protocol';

type TransactionState = {
  /** Absent until the native transaction callback acquires the connection. */
  readonly handle: Transaction | undefined;
  readonly completion: PromiseWithResolvers<void>;
  readonly finished: PromiseWithResolvers<void>;
};

type WorkerState = {
  /** Absent before an Open command creates the database. */
  readonly database: Database | undefined;
  readonly file: string;
  readonly maxBytes: Bytes;
};

const FILE_ERROR = { NotFound: 'NotFoundError' } as const;

type OpenFilesInput = { readonly file: string; readonly maxAge: Duration.Duration; readonly maxBytes: Bytes };

function main(): void {
  const CacheStamp = Schema.Struct({ createdAt: Schema.DateTimeUtcFromMillis });

  type CacheStamp = typeof CacheStamp.Type;

  const UnknownFileError = Schema.StructWithRest(Schema.Struct({ name: Schema.String }), [
    Schema.Record(Schema.String, Schema.Unknown),
  ]);

  type UnknownFileError = typeof UnknownFileError.Type;

  const state: Types.Mutable<WorkerState> = { database: undefined, file: '', maxBytes: Bytes.make(0) };
  const transactions = new Map<StoreTransactionId, Types.Mutable<TransactionState>>();
  const rollback = new StoreFailed({ reason: 'Transaction was rolled back' });
  const decodeRequest = Schema.decodeUnknownResult(StoreRequest, { onExcessProperty: 'error' });
  const decodeFileError = Schema.decodeUnknownResult(UnknownFileError, { onExcessProperty: 'error' });
  const decodeStamp = Schema.decodeUnknownResult(Schema.fromJsonString(CacheStamp), { onExcessProperty: 'error' });

  async function readFile(file: string): Promise<File | undefined> {
    try {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle(file);

      return await handle.getFile();
    } catch (failure) {
      const decoded = decodeFileError(failure);

      if (Result.isSuccess(decoded) && decoded.success.name === FILE_ERROR.NotFound) {
        return undefined;
      }

      throw failure;
    }
  }

  async function discardFiles(file: string): Promise<void> {
    const root = await navigator.storage.getDirectory();
    // Invalidate reuse before removal can fail on an open database handle.
    const files = [`${file}.meta`, file, `${file}-wal`];

    for (const name of files) {
      try {
        await root.removeEntry(name);
      } catch (failure) {
        const decoded = decodeFileError(failure);

        if (Result.isFailure(decoded) || decoded.success.name !== FILE_ERROR.NotFound) {
          throw failure;
        }
      }
    }
  }

  async function readSize(file: string): Promise<number> {
    const database = await readFile(file);
    const wal = await readFile(`${file}-wal`);

    return (database?.size ?? 0) + (wal?.size ?? 0);
  }

  async function prepareFiles({ file, maxAge, maxBytes }: OpenFilesInput): Promise<number> {
    const maxAgeMs = Duration.toMillis(maxAge);
    const stamp = await readFile(`${file}.meta`);

    if (stamp !== undefined) {
      const text = await stamp.text();
      const decoded = decodeStamp(text);
      const sizeBytes = await readSize(file);

      if (Result.isSuccess(decoded)) {
        const createdAtMs = DateTime.toEpochMillis(decoded.success.createdAt);
        const ageMs = Date.now() - createdAtMs;

        if (ageMs >= 0 && ageMs < maxAgeMs && sizeBytes <= maxBytes) {
          return createdAtMs + maxAgeMs;
        }
      }
    }

    await discardFiles(file);

    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(`${file}.meta`, { create: true });
    const writable = await handle.createWritable();
    const metadata: CacheStamp = { createdAt: DateTime.nowUnsafe() };
    const wire = Schema.encodeSync(CacheStamp)(metadata);
    const encoded = JSON.stringify(wire);

    await writable.write(encoded);
    await writable.close();

    const createdAtMs = DateTime.toEpochMillis(metadata.createdAt);

    return createdAtMs + maxAgeMs;
  }

  async function checkSize(): Promise<void> {
    const sizeBytes = await readSize(state.file);

    if (sizeBytes <= state.maxBytes) {
      return;
    }

    const reason = 'Database exceeded the cache size limit';
    const reply = StoreReply.cases.Fatal.make({ reason });

    globalThis.postMessage(reply, { transfer: [] });

    throw new StoreFailed({ reason });
  }

  function readDatabase(): Database {
    if (state.database === undefined) {
      throw new StoreFailed({ reason: 'Database is not open' });
    }

    return state.database;
  }

  function readTransaction(transactionId: StoreTransactionId): Types.Mutable<TransactionState> {
    const transaction = transactions.get(transactionId);

    if (transaction === undefined) {
      throw new StoreFailed({ reason: 'Transaction is not active' });
    }

    return transaction;
  }

  function readConnection(transactionId: StoreTransactionId | null): Database | Transaction {
    if (transactionId === null) {
      return readDatabase();
    }

    const transaction = readTransaction(transactionId);

    if (transaction.handle === undefined) {
      throw new StoreFailed({ reason: 'Transaction has not started' });
    }

    return transaction.handle;
  }

  async function dispatch(command: StoreCommand): Promise<unknown> {
    return await StoreCommand.match(command, {
      Open: async ({ file, maxAge, maxBytes }) => {
        const expiresAtMs = await prepareFiles({ file, maxAge, maxBytes });

        const turso = await import('@tursodatabase/database-wasm/vite');

        state.file = file;
        state.maxBytes = maxBytes;
        state.database = new turso.Database(file);

        await state.database.connect();

        return expiresAtMs;
      },
      Discard: async ({ file }) => {
        await discardFiles(file);

        return null;
      },
      Close: async () => {
        await state.database?.close();

        return null;
      },
      Begin: async ({ transactionId }) => {
        const admitted = Promise.withResolvers<void>();

        const transaction: Types.Mutable<TransactionState> = {
          handle: undefined,
          completion: Promise.withResolvers<void>(),
          finished: Promise.withResolvers<void>(),
        };

        transactions.set(transactionId, transaction);

        const database = readDatabase();

        const begin = database.transactionAsync(async (handle) => {
          transaction.handle = handle;

          admitted.resolve();
          await transaction.completion.promise;
        });

        const finished = begin();

        void finished.then(transaction.finished.resolve, transaction.finished.reject);
        void transaction.finished.promise.catch((failure: unknown) => {
          admitted.reject(failure);
        });

        await admitted.promise;

        return null;
      },
      Commit: async ({ transactionId }) => {
        const transaction = readTransaction(transactionId);

        transaction.completion.resolve();

        try {
          await transaction.finished.promise;
        } finally {
          transactions.delete(transactionId);
        }

        await checkSize();

        return null;
      },
      Rollback: async ({ transactionId }) => {
        const transaction = readTransaction(transactionId);

        transaction.completion.reject(rollback);

        try {
          await transaction.finished.promise;
        } catch (failure) {
          if (failure !== rollback) {
            throw failure;
          }
        } finally {
          transactions.delete(transactionId);
        }

        return null;
      },
      Exec: async ({ transactionId, sql }) => {
        const connection = readConnection(transactionId);

        await connection.exec(sql);

        if (transactionId === null) {
          await checkSize();
        }

        return null;
      },
      Query: async ({ transactionId, sql, params }) => {
        const connection = readConnection(transactionId);
        const statement = await connection.prepare(sql);

        try {
          const rows: unknown = await statement.all(...params);

          return rows;
        } finally {
          statement.close();
        }
      },
      Run: async ({ transactionId, sql, params }) => {
        const connection = readConnection(transactionId);
        const statement = await connection.prepare(sql);

        try {
          await statement.run(...params);
        } finally {
          statement.close();
        }

        if (transactionId === null) {
          await checkSize();
        }

        return null;
      },
    });
  }

  async function receive(event: MessageEvent<unknown>): Promise<void> {
    const decoded = decodeRequest(event.data);

    if (Result.isFailure(decoded)) {
      const reply = StoreReply.cases.Fatal.make({ reason: String(decoded.failure) });

      globalThis.postMessage(reply, { transfer: [] });

      return;
    }

    const request = decoded.success;

    try {
      const value = await dispatch(request.command);
      const reply = StoreReply.cases.Completed.make({ requestId: request.requestId, value });

      globalThis.postMessage(reply, { transfer: [] });
    } catch (failure) {
      const reply = StoreReply.cases.Failed.make({ requestId: request.requestId, reason: String(failure) });

      globalThis.postMessage(reply, { transfer: [] });
    }
  }

  globalThis.addEventListener('message', (event: MessageEvent<unknown>) => {
    void receive(event);
  });

  const ready = StoreReply.cases.Ready.make({});

  globalThis.postMessage(ready, { transfer: [] });
}

main();
