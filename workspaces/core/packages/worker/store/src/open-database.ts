import { applyMigrations } from './apply-migrations.ts';
import { schemaRevision } from './schema-revision.ts';
import type { DatabaseFunctions, Migration } from './types.ts';

/** An object's storage, and the schema steps its database applies. */
type OpenDatabaseInput = { readonly storage: DurableObjectStorage; readonly migrations: ReadonlyArray<Migration> };

/**
 * Opens an object's synchronous database and applies, in one transaction, every migration its ledger does not record. A
 * stored row that fails to decode is a defect: only the object's store writes the database.
 */
export function openDatabase({ storage, migrations }: OpenDatabaseInput): DatabaseFunctions {
  const { sql } = storage;

  storage.transactionSync(() => applyMigrations({ sql, migrations }));

  return { schemaRevision: () => schemaRevision({ sql }), atomic: ({ run }) => storage.transactionSync(run) };
}
