import { postgresSchemaStatements } from '@chat-adapter/state-pg';
import { Schema } from 'effect';
import { createHash } from 'node:crypto';
import { Pool, types } from 'pg';
import type { CredentialKeyring } from '../domain.ts';
import { createAuthStore } from './api/auth/auth.ts';
import { createConfigurationRecords } from './api/configuration/configuration.ts';
import { createMechStore } from './api/mechs/mechs.ts';
import { createReadStore } from './api/reads/reads.ts';
import { createBudgetStore } from './budgets.ts';
import { createChannelStore } from './channels/channel-store.ts';
import { poolContext } from './context.ts';
import type { StoreContext } from './context.ts';
import { createCredentialStore } from './credentials.ts';
import { createExecutionReceiptStore } from './execution-receipts.ts';
import { createExecutionStore } from './execution/execution-store.ts';
import { createMemoryStore } from './memories.ts';
import { createRequestStore } from './request-events.ts';
import { createSandboxCapacityStore } from './sandbox-capacity.ts';
import { DOMAIN_MIGRATIONS } from './schema.ts';
import { createSessionContextStore } from './session-context.ts';
import { createWorkStore } from './work-items.ts';

const POSTGRES_PROTOCOLS: ReadonlySet<string> = new Set(['postgres:', 'postgresql:']);
const DEFAULT_MAX_CONNECTIONS = 4;
const CONNECTION_TIMEOUT_MILLISECONDS = 10_000;
const IDLE_TIMEOUT_MILLISECONDS = 30_000;
const MIGRATION_LOCK = 1_823_944_617;
const MigrationRow = Schema.Struct({ version: Schema.Number, checksum: Schema.String });
type MigrationRow = typeof MigrationRow.Type;
type DatabaseInput = { readonly databaseUrl: string };
type OpenStoreInput = DatabaseInput & { readonly keyring: CredentialKeyring; readonly maxConnections?: number };

function validateAppliedMigrations(applied: ReadonlyArray<MigrationRow>): void {
  for (const [index, migration] of DOMAIN_MIGRATIONS.entries()) {
    if (migration.version !== index + 1) {
      throw new Error('Release database migrations are not contiguous');
    }
  }

  for (const [index, recorded] of applied.entries()) {
    if (recorded.version !== index + 1) {
      throw new Error('Database migration history is not contiguous');
    }

    const migration = DOMAIN_MIGRATIONS[index];

    if (migration !== undefined) {
      const checksum = createHash('sha256').update(migration.sql).digest('hex');

      if (recorded.checksum !== checksum) {
        throw new Error('An applied database migration changed');
      }
    }
  }
}

function safeInteger(value: string): number {
  const number = Number(value);

  if (!Number.isSafeInteger(number)) {
    throw new TypeError('Stored integer exceeds the supported range');
  }

  return number;
}

function openPool({
  databaseUrl,
  maxConnections = DEFAULT_MAX_CONNECTIONS,
}: DatabaseInput & { readonly maxConnections?: number }): Pool {
  try {
    const parsed = new URL(databaseUrl);

    if (!POSTGRES_PROTOCOLS.has(parsed.protocol)) {
      throw new Error('Unsupported database URL');
    }
  } catch {
    throw new Error('Database configuration is invalid');
  }

  return new Pool({
    connectionString: databaseUrl,
    max: maxConnections,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MILLISECONDS,
    idleTimeoutMillis: IDLE_TIMEOUT_MILLISECONDS,
    options: '-c timezone=UTC',
    types: {
      getTypeParser: (identifier, format): unknown => {
        if (identifier === types.builtins.TIMESTAMPTZ && format !== 'binary') {
          return (value: string) => new Date(value).toISOString();
        }

        if (identifier === types.builtins.INT8 && format !== 'binary') {
          return safeInteger;
        }

        return types.getTypeParser(identifier, format);
      },
    },
  });
}

function createRuntimeRecords(context: StoreContext, keyring: CredentialKeyring) {
  return {
    ...createAuthStore(context),
    ...createConfigurationRecords(context),
    ...createMechStore(context),
    ...createReadStore(context),
    ...createBudgetStore(context),
    ...createChannelStore(context),
    ...createCredentialStore(context, keyring),
    ...createExecutionStore(context),
    ...createMemoryStore(context),
    ...createWorkStore(context),
    ...createExecutionReceiptStore(context),
    ...createRequestStore(context),
    ...createSessionContextStore(context),
    ...createSandboxCapacityStore(context),
    checkHealth: async (): Promise<void> => {
      await context.client.query('SELECT id FROM mechane.mechs LIMIT 1');
    },
    schemaRevision: async (): Promise<number> => {
      const result = await context.client.query(
        'SELECT version,checksum FROM mechane.schema_migrations ORDER BY version',
      );

      const applied = Schema.decodeUnknownSync(Schema.Array(MigrationRow))(result.rows);

      validateAppliedMigrations(applied);

      if (applied.length < DOMAIN_MIGRATIONS.length) {
        throw new Error('The database schema is missing a migration required by this release');
      }

      // Migration review establishes compatibility; this check verifies only the release's required prefix.
      return applied.length;
    },
  };
}

export type RuntimeStore = ReturnType<typeof createRuntimeRecords> & {
  readonly runInTransaction: <Result>(operation: (store: RuntimeStore) => Promise<Result>) => Promise<Result>;
};

function createTransactionStore(context: StoreContext, keyring: CredentialKeyring): RuntimeStore {
  const store: RuntimeStore = {
    ...createRuntimeRecords(context, keyring),
    runInTransaction: async (operation) => await operation(store),
  };

  return store;
}

function createRuntimeStore(context: StoreContext, keyring: CredentialKeyring): RuntimeStore {
  return {
    ...createRuntimeRecords(context, keyring),
    runInTransaction: async (operation) =>
      await context.atomic(async (transaction) => await operation(createTransactionStore(transaction, keyring))),
  };
}

export async function openStore({
  databaseUrl,
  keyring,
  maxConnections,
}: OpenStoreInput): Promise<RuntimeStore & { readonly close: () => Promise<void> }> {
  const pool = openPool({ databaseUrl, maxConnections: maxConnections ?? DEFAULT_MAX_CONNECTIONS });
  const store = createRuntimeStore(poolContext(pool), keyring);

  try {
    await store.schemaRevision();
    await store.checkHealth();
  } catch (error) {
    await pool.end();

    throw error;
  }

  return { ...store, close: async () => await pool.end() };
}

export async function migrateStore({ databaseUrl }: DatabaseInput): Promise<void> {
  const pool = openPool({ databaseUrl, maxConnections: 1 });

  try {
    await poolContext(pool).atomic(async ({ client }) => {
      await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK]);

      const table = await client.query("SELECT to_regclass('mechane.schema_migrations') AS name");
      const existing = Schema.decodeUnknownSync(Schema.Struct({ name: Schema.NullOr(Schema.String) }))(table.rows[0]);
      const applied: Array<MigrationRow> = [];

      if (existing.name !== null) {
        const rows = await client.query('SELECT version,checksum FROM mechane.schema_migrations ORDER BY version');

        applied.push(...Schema.decodeUnknownSync(Schema.Array(MigrationRow))(rows.rows));
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

      await client.query('CREATE SCHEMA IF NOT EXISTS chat');
      await client.query('SET LOCAL search_path TO chat');

      for (const statement of postgresSchemaStatements) {
        await client.query(statement);
      }
    });
  } finally {
    await pool.end();
  }
}
