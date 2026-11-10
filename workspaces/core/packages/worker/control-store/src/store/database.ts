import { Schema } from 'effect';
import { createHash } from 'node:crypto';
import type { ControlChange } from '../control-change.ts';
import type { CredentialKeyring } from '../domain.ts';
import { createAuthStore } from './api/auth/auth.ts';
import { createConfigurationRecords } from './api/configuration/configuration.ts';
import { createMechStore } from './api/mechs/mechs.ts';
import { poolContext } from './context.ts';
import type { StoreContext } from './context.ts';
import { createControlChangeStore } from './control-changes.ts';
import { createCredentialStore } from './credentials.ts';
import { createImportedHistoryStore } from './imported-history/history.ts';
import { createMemberAdmissionStore } from './member-admission.ts';
import { openPool } from './postgres.ts';
import type { DatabaseInput } from './postgres.ts';
import { createProviderAttemptStore } from './provider-attempts.ts';
import { StoredText } from './row-values.ts';
import { createSandboxCapacityStore } from './sandbox-capacity.ts';
import { readMigrationHistory, requireSchemaRevision, validateAppliedMigrations } from './schema-revision.ts';
import type { MigrationRow } from './schema-revision.ts';
import { DOMAIN_MIGRATIONS } from './schema.ts';

const DEFAULT_MAX_CONNECTIONS = 4;
const MIGRATION_LOCK = 1_823_944_617;

export type OpenControlStoreInput = DatabaseInput & {
  readonly keyring: CredentialKeyring;
  readonly maxConnections?: number;
};

function createControlRecords(context: StoreContext, keyring: CredentialKeyring) {
  return {
    ...createAuthStore(context),
    ...createConfigurationRecords(context),
    ...createMechStore(context),
    ...createProviderAttemptStore(context),
    ...createControlChangeStore(context),
    ...createImportedHistoryStore(context),
    ...createMemberAdmissionStore(context),
    ...createCredentialStore(context, keyring),
    ...createSandboxCapacityStore(context),
    checkHealth: async (): Promise<void> => {
      await context.client.query('SELECT id FROM mechane.mechs LIMIT 1');
    },
    schemaRevision: async (): Promise<number> =>
      await requireSchemaRevision({ context, minimumVersion: DOMAIN_MIGRATIONS.length }),
  };
}

export type ControlStore = ReturnType<typeof createControlRecords>;
type CapturedControlChanges<Result> = { readonly value: Result; readonly changes: ReadonlyArray<ControlChange> };

export type CaptureControlChanges = <Result>(input: {
  readonly run: (store: ControlStore) => Promise<Result>;
}) => Promise<CapturedControlChanges<Result>>;

export async function openControlStore({
  databaseUrl,
  keyring,
  maxConnections,
}: OpenControlStoreInput): Promise<
  ControlStore & { readonly close: () => Promise<void>; readonly captureControlChanges: CaptureControlChanges }
> {
  const pool = openPool({ databaseUrl, maxConnections: maxConnections ?? DEFAULT_MAX_CONNECTIONS });
  const store = createControlRecords(poolContext(pool), keyring);

  try {
    await store.schemaRevision();
    await store.checkHealth();
  } catch (error) {
    await pool.end();

    throw error;
  }

  const captureControlChanges: CaptureControlChanges = async ({ run }) => {
    const changes: Array<ControlChange> = [];

    const context = poolContext(pool, (committed) => {
      changes.push(...committed);
    });

    const scoped = createControlRecords(context, keyring);
    const value = await run(scoped);

    return { value, changes: [...changes] };
  };

  return { ...store, captureControlChanges, close: async () => await pool.end() };
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
