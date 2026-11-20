import {
  createAuthStore,
  createConfigurationRecords,
  createCredentialStore,
  createProviderAttemptStore,
  createSandboxCapacityStore,
  openPool,
  poolContext,
  StoredText,
} from '@mechane/authority-store';
import type { CredentialKeyring, DatabaseInput, StoreContext } from '@mechane/authority-store';
import { createManagedCatalog } from '@mechane/managed-store';
import { Schema } from 'effect';
import { createHash } from 'node:crypto';
import { readMigrationHistory, requireSchemaRevision, validateAppliedMigrations } from './schema-revision.ts';
import type { MigrationRow } from './schema-revision.ts';
import { DOMAIN_MIGRATIONS } from './schema.ts';

const DEFAULT_MAX_CONNECTIONS = 8;
const MIGRATION_LOCK = 1_823_944_617;

export type OpenControlStoreInput = DatabaseInput & {
  readonly keyring: CredentialKeyring;
  readonly maxConnections?: number;
};

function createControlRecords(context: StoreContext, keyring: CredentialKeyring) {
  return {
    managed: createManagedCatalog(context, keyring),
    ...createAuthStore(context),
    ...createConfigurationRecords(context),
    ...createProviderAttemptStore(context),
    ...createCredentialStore(context, keyring),
    ...createSandboxCapacityStore(context),
    checkHealth: async (): Promise<void> => {
      await context.client.query('SELECT id FROM mechane.workspaces LIMIT 1');
    },
    schemaRevision: async (): Promise<number> =>
      await requireSchemaRevision({ context, minimumVersion: DOMAIN_MIGRATIONS.length }),
  };
}

export type ControlStore = ReturnType<typeof createControlRecords>;

export async function openControlStore({
  databaseUrl,
  keyring,
  maxConnections,
}: OpenControlStoreInput): Promise<ControlStore & { readonly close: () => Promise<void> }> {
  const pool = openPool({ databaseUrl, maxConnections: maxConnections ?? DEFAULT_MAX_CONNECTIONS });
  const store = createControlRecords(poolContext(pool), keyring);

  try {
    await store.schemaRevision();
    await store.checkHealth();
  } catch (error) {
    await pool.end();

    throw error;
  }

  return { ...store, close: async () => await pool.end() };
}

export async function migrateControlStore({ databaseUrl }: DatabaseInput): Promise<void> {
  const pool = openPool({ databaseUrl, maxConnections: 1 });

  try {
    await poolContext(pool).atomic(async (context) => {
      const { client } = context;

      await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK]);

      const table = await client.query("SELECT to_regclass('mechane.schema_migrations') AS name");
      const existing = Schema.decodeUnknownSync(Schema.Struct({ name: Schema.NullOr(StoredText) }))(table.rows[0]);
      const applied: Array<MigrationRow> = [];

      if (existing.name !== null) {
        const rows = await readMigrationHistory(context);

        applied.push(...rows);
      }

      if (applied.length > DOMAIN_MIGRATIONS.length) {
        throw new Error('Database schema is newer than this release');
      }

      validateAppliedMigrations(applied);

      for (const migration of DOMAIN_MIGRATIONS.slice(applied.length)) {
        const checksum = createHash('sha256').update(migration.sql).digest('hex');

        await client.query(migration.sql);
        await client.query('INSERT INTO mechane.schema_migrations(version,checksum) VALUES($1,$2)', [
          migration.version,
          checksum,
        ]);
      }
    });
  } finally {
    await pool.end();
  }
}
