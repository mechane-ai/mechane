import { collectionOptions, localOnlyCollectionOptions } from '@tanstack/db';
import type { Collection, CollectionConfig, DbClient, InferSchemaOutput } from '@tanstack/db';
import { persistedCollectionOptions } from '@tanstack/db-sqlite-persistence-core';
import type { PersistedCollectionPersistence, PersistedCollectionUtils } from '@tanstack/db-sqlite-persistence-core';
import { Schema } from 'effect';
import {
  AllowanceRow,
  EventRow,
  MechDefinitionRow,
  MechSummaryRow,
  MemoryRow,
  restoreRecord,
  SlackBindingRow,
  SlackDeliveryRow,
  ThreadRow,
  TraceEvidenceRow,
  TurnRow,
} from './records.ts';

type KeyedRow = { readonly key: string };
type RowSchema<Row extends object> = ReturnType<typeof Schema.toStandardSchemaV1<Schema.Codec<Row>>>;
/** A native DbClient descriptor preserving a canonical row's typed encoded fields. */
export type CanonicalCollectionOptions<Row extends KeyedRow> = ReturnType<typeof table<Row>>;

type CanonicalCollection<Row extends object> = Collection<Row, string, PersistedCollectionUtils, RowSchema<Row>, Row>;

type CanonicalConfiguration<Row extends KeyedRow> = CollectionConfig<
  InferSchemaOutput<RowSchema<Row>>,
  string,
  RowSchema<Row>,
  PersistedCollectionUtils
>;

function table<Row extends KeyedRow>(
  id: string,
  row: Schema.Codec<Row>,
  persistence: PersistedCollectionPersistence | undefined,
) {
  const schema = Schema.toStandardSchemaV1(row);

  function getKey(item: InferSchemaOutput<RowSchema<Row>>) {
    return restoreRecord(row, item).key;
  }

  function options(): CanonicalConfiguration<Row> & Required<Pick<CanonicalConfiguration<Row>, 'schema' | 'utils'>> {
    if (persistence === undefined) {
      return localOnlyCollectionOptions({ id, getKey, schema });
    }

    return persistedCollectionOptions({ id, getKey, schema, persistence });
  }

  return collectionOptions(id, options);
}

/** Names a table within one authenticated origin, principal, and workspace. */
export function collectionId(scope: string, name: string): string {
  return JSON.stringify([scope, name]);
}

/** Declares each canonical table using the scope's selected persistent or memory storage. */
export function createCanonicalCollections(scope: string, persistence: PersistedCollectionPersistence | undefined) {
  return {
    mechs: table(collectionId(scope, 'mechs'), MechSummaryRow, persistence),
    mechDefinitions: table(collectionId(scope, 'mech-definitions'), MechDefinitionRow, persistence),
    turns: table(collectionId(scope, 'turns'), TurnRow, persistence),
    events: table(collectionId(scope, 'events'), EventRow, persistence),
    threads: table(collectionId(scope, 'threads'), ThreadRow, persistence),
    memories: table(collectionId(scope, 'memories'), MemoryRow, persistence),
    traceEvidence: table(collectionId(scope, 'trace-evidence'), TraceEvidenceRow, persistence),
    slackBindings: table(collectionId(scope, 'slack-bindings'), SlackBindingRow, persistence),
    slackDeliveries: table(collectionId(scope, 'slack-deliveries'), SlackDeliveryRow, persistence),
    allowance: table(collectionId(scope, 'allowance'), AllowanceRow, persistence),
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
    threads: db.collection(collections.threads),
    memories: db.collection(collections.memories),
    traceEvidence: db.collection(collections.traceEvidence),
    slackBindings: db.collection(collections.slackBindings),
    slackDeliveries: db.collection(collections.slackDeliveries),
    allowance: db.collection(collections.allowance),
  };
}

/** The scope's native tables, shared by response ingestion and live reads. */
export type CanonicalTables = ReturnType<typeof materializeCanonicalCollections>;
type LocalWriter = Pick<CanonicalCollection<KeyedRow>, 'preload' | 'utils'>;

type CommitRows = {
  readonly db: DbClient;
  readonly collections: ReadonlyArray<LocalWriter>;
  readonly signal: AbortSignal;
  readonly write: () => void;
};

/** Commits acknowledged rows and waits for every affected native persistence writer. */
export async function commitRows({ db, collections, signal, write }: CommitRows): Promise<void> {
  await Promise.all(collections.map((collection) => collection.preload()));
  signal.throwIfAborted();

  const transaction = db.createTransaction({
    mutationFn: async ({ transaction: pending }) => {
      await Promise.all(
        collections.map(async (collection) => {
          await collection.utils.acceptMutations(pending);
        }),
      );
    },
  });

  transaction.mutate(write);
  await transaction.when('settled');
  signal.throwIfAborted();
}

/** Enqueues fetched or acknowledged values in the caller's native transaction. */
export function upsertRows<Row extends KeyedRow>(collection: CanonicalCollection<Row>, rows: ReadonlyArray<Row>): void {
  for (const row of rows) {
    if (collection.has(row.key)) {
      // TanStack owns the mutable draft supplied to this native update callback.
      // ast-grep-ignore: parameter-mutation
      collection.update(row.key, (draft) => Object.assign(draft, row));
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
