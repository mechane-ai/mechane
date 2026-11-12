import {
  CONSOLE_STORAGE_OPERATION_TIMEOUT_MS,
  ConsoleStorageFailed,
  ConsoleStorageStage,
} from '@mechane/console-cache';
import type { openConsoleStorage } from '@mechane/console-cache';
import { collectionOptions } from '@tanstack/db';
import type { Collection, CollectionConfig, DbClient, InferSchemaOutput } from '@tanstack/db';
import { persistedCollectionOptions } from '@tanstack/db-sqlite-persistence-core';
import type { PersistedCollectionPersistence, PersistedCollectionUtils } from '@tanstack/db-sqlite-persistence-core';
import { MutableRef, Schema } from 'effect';
import {
  AllowanceRow,
  EnvironmentProcessDetailsRow,
  EnvironmentReportRow,
  EventRow,
  EvidenceArtifactRow,
  MechDefinitionRow,
  MechSummaryRow,
  restoreRecord,
  TraceEvidenceRow,
  TurnRow,
} from './records.ts';
import { ReadReceipt } from './requests.ts';

type KeyedRow = { readonly key: string };
// Admission can wait for preparation, acceptance, and an uncertain owner's bounded close.
const WRITE_ADMISSION_PHASES = 3;
const WRITE_ADMISSION_TIMEOUT_MS = CONSOLE_STORAGE_OPERATION_TIMEOUT_MS * WRITE_ADMISSION_PHASES;

type CanonicalPersistenceOperations = PersistedCollectionUtils &
  Required<Pick<PersistedCollectionUtils, 'forceReloadSubset'>>;

class PersistenceUnavailable extends Schema.TaggedError<PersistenceUnavailable>()('PersistenceUnavailable', {}) {}

type RowSchema<Row extends object> = ReturnType<typeof Schema.toStandardSchemaV1<Schema.Codec<Row>>>;
/** A native DbClient descriptor preserving a canonical row's typed encoded fields. */
export type CanonicalCollectionOptions<Row extends KeyedRow> = ReturnType<typeof table<Row>>;

type CanonicalCollection<Row extends object> = Collection<
  Row,
  string,
  CanonicalPersistenceOperations,
  RowSchema<Row>,
  Row
>;

type CanonicalConfiguration<Row extends object> = CollectionConfig<
  InferSchemaOutput<RowSchema<Row>>,
  string,
  RowSchema<Row>,
  CanonicalPersistenceOperations
>;

type TableDefinition<Row extends object> = {
  readonly name: string;
  readonly row: Schema.Codec<Row>;
  readonly persistence: PersistedCollectionPersistence;
  readonly key: (value: Row) => string;
};

function table<Row extends object>({ name, row, persistence, key }: TableDefinition<Row>) {
  const schema = Schema.toStandardSchemaV1(row);

  function getKey(item: InferSchemaOutput<RowSchema<Row>>) {
    return key(restoreRecord(row, item));
  }

  function options(): CanonicalConfiguration<Row> & Required<Pick<CanonicalConfiguration<Row>, 'schema' | 'utils'>> {
    const persisted = persistedCollectionOptions({ id: name, getKey, schema, persistence });
    const { forceReloadSubset } = persisted.utils;

    if (forceReloadSubset === undefined) {
      throw new PersistenceUnavailable({});
    }

    return { ...persisted, utils: { ...persisted.utils, forceReloadSubset } };
  }

  return collectionOptions(name, options);
}

function rowKey(row: KeyedRow): string {
  return row.key;
}

/** Names a table within one authenticated origin, principal, and workspace. */
function collectionId(scope: string, name: string): string {
  return JSON.stringify([scope, name]);
}

/** Records and exact page coverage share one admitted persistent owner. */
export function createCanonicalCollections(scope: string, persistence: PersistedCollectionPersistence) {
  return {
    mechs: table({ name: collectionId(scope, 'mechs'), row: MechSummaryRow, persistence, key: rowKey }),
    mechDefinitions: table({
      name: collectionId(scope, 'mech-definitions'),
      row: MechDefinitionRow,
      persistence,
      key: rowKey,
    }),
    turns: table({ name: collectionId(scope, 'turns'), row: TurnRow, persistence, key: rowKey }),
    events: table({ name: collectionId(scope, 'events'), row: EventRow, persistence, key: rowKey }),
    traceEvidence: table({
      name: collectionId(scope, 'trace-evidence'),
      row: TraceEvidenceRow,
      persistence,
      key: rowKey,
    }),
    evidenceArtifacts: table({
      name: collectionId(scope, 'evidence-artifacts'),
      row: EvidenceArtifactRow,
      persistence,
      key: rowKey,
    }),
    environments: table({
      name: collectionId(scope, 'environments'),
      row: EnvironmentReportRow,
      persistence,
      key: rowKey,
    }),
    environmentProcessDetails: table({
      name: collectionId(scope, 'environment-process-details'),
      row: EnvironmentProcessDetailsRow,
      persistence,
      key: rowKey,
    }),
    allowance: table({ name: collectionId(scope, 'allowance'), row: AllowanceRow, persistence, key: rowKey }),
    reads: table({ name: collectionId(scope, 'reads'), row: ReadReceipt, persistence, key: (receipt) => receipt.id }),
  };
}

type CanonicalCollections = ReturnType<typeof createCanonicalCollections>;

/** Materializes each descriptor once within the scope's owning native DbClient. */
export function materializeCanonicalCollections(db: DbClient, collections: CanonicalCollections) {
  return {
    mechs: db.collection(collections.mechs),
    mechDefinitions: db.collection(collections.mechDefinitions),
    turns: db.collection(collections.turns),
    events: db.collection(collections.events),
    traceEvidence: db.collection(collections.traceEvidence),
    evidenceArtifacts: db.collection(collections.evidenceArtifacts),
    environments: db.collection(collections.environments),
    environmentProcessDetails: db.collection(collections.environmentProcessDetails),
    allowance: db.collection(collections.allowance),
    reads: db.collection(collections.reads),
  };
}

/** The scope's native tables, shared by response ingestion and live reads. */
export type CanonicalTables = ReturnType<typeof materializeCanonicalCollections>;

type LocalWriter = Pick<CanonicalCollection<object>, 'preload' | 'utils'>;

type CommitRows = {
  readonly collections: ReadonlyArray<LocalWriter>;
  readonly signal: AbortSignal;
  readonly write: () => void;
};

type CreateCanonicalWriter = Pick<Awaited<ReturnType<typeof openConsoleStorage>>, 'generationId'> & {
  readonly db: DbClient;
  readonly retire: (failure: unknown) => Promise<void>;
};

/** Domain guards run against current durable rows before any native mutation is prepared. */
export function createCanonicalWriter({ db, generationId, retire }: CreateCanonicalWriter) {
  const lock = JSON.stringify(['mechane-console-write', generationId]);

  return async ({ collections, signal, write }: CommitRows): Promise<void> => {
    const admission = AbortSignal.any([signal, AbortSignal.timeout(WRITE_ADMISSION_TIMEOUT_MS)]);

    await navigator.locks.request(lock, { signal: admission }, async () => {
      signal.throwIfAborted();

      const lifetime = new AbortController();
      const preparation = AbortSignal.any([signal, lifetime.signal]);
      const hasAttemptedMutation = MutableRef.make(false);

      async function withinPhase(
        stage: typeof ConsoleStorageStage.CanonicalPrepare | typeof ConsoleStorageStage.CanonicalCommit,
        operation: Promise<void>,
      ): Promise<void> {
        const expired = Promise.withResolvers<never>();

        const deadline = setTimeout(() => {
          const failure = new ConsoleStorageFailed({ stage, reason: 'Native collection work timed out' });

          lifetime.abort(failure);
          expired.reject(failure);
        }, CONSOLE_STORAGE_OPERATION_TIMEOUT_MS);

        try {
          await Promise.race([operation, expired.promise]);
        } catch (error) {
          const failedStage =
            stage === ConsoleStorageStage.CanonicalCommit && !hasAttemptedMutation.current
              ? ConsoleStorageStage.CanonicalPrepare
              : stage;

          throw Schema.is(ConsoleStorageFailed)(error)
            ? error
            : new ConsoleStorageFailed({ stage: failedStage, reason: String(error) });
        } finally {
          clearTimeout(deadline);
        }
      }

      async function prepare(): Promise<void> {
        await Promise.all(collections.map((collection) => collection.preload()));
        preparation.throwIfAborted();
        await Promise.all(
          collections.map(async (collection) => {
            await collection.utils.forceReloadSubset({});
          }),
        );
        preparation.throwIfAborted();
      }

      async function commit(): Promise<void> {
        preparation.throwIfAborted();

        const transaction = db.createTransaction({
          mutationFn: async ({ transaction: pending }) => {
            await Promise.all(
              collections.map(async (collection) => {
                hasAttemptedMutation.current = true;

                await collection.utils.acceptMutations(pending);
              }),
            );
          },
        });

        transaction.mutate(write);
        await transaction.when('settled');
      }

      try {
        await withinPhase(ConsoleStorageStage.CanonicalPrepare, prepare());
        await withinPhase(ConsoleStorageStage.CanonicalCommit, commit());
      } catch (error) {
        lifetime.abort(error);

        if (hasAttemptedMutation.current) {
          await retire(error);
        }

        throw error;
      }
    });

    signal.throwIfAborted();
  };
}

/** Admits one guarded update to the current generation's canonical tables. */
export type CanonicalWriter = ReturnType<typeof createCanonicalWriter>;

/** Enqueues fetched or acknowledged values in the caller's native transaction. */
export function upsertRows<Row extends object>(collection: CanonicalCollection<Row>, rows: ReadonlyArray<Row>): void {
  for (const row of rows) {
    const key = collection.getKeyFromItem(row);

    if (collection.has(key)) {
      // TanStack owns the mutable draft supplied to this native update callback.
      // ast-grep-ignore: parameter-mutation
      collection.update(key, (draft) => Object.assign(draft, row));
    } else {
      collection.insert(row);
    }
  }
}

type RowDeletion = { readonly has: (key: string) => boolean; readonly delete: (key: string) => unknown };

/** Removes keys when an authoritative complete read or denial permits deletion. */
export function deleteRows(collection: RowDeletion, keys: ReadonlyArray<string>): void {
  for (const key of keys) {
    if (collection.has(key)) {
      // This native operation removes an acknowledged server record from its collection.
      // ast-grep-ignore: parameter-mutation
      collection.delete(key);
    }
  }
}
