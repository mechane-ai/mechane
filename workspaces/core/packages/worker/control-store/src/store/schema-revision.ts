import { StoredChecksum } from '@mechane/authority-store';
import type { StoreContext } from '@mechane/authority-store';
import { Schema } from 'effect';
import { createHash } from 'node:crypto';
import { DOMAIN_MIGRATIONS } from './schema.ts';

const MigrationRow = Schema.Struct({ version: Schema.Number, checksum: StoredChecksum });
export type MigrationRow = typeof MigrationRow.Type;

const EXPECTED_MIGRATION_CHECKSUMS: ReadonlyArray<string> = DOMAIN_MIGRATIONS.map((migration) =>
  createHash('sha256').update(migration.sql).digest('hex'),
);

export function validateAppliedMigrations(applied: ReadonlyArray<MigrationRow>): void {
  for (const [index, migration] of DOMAIN_MIGRATIONS.entries()) {
    if (migration.version !== index + 1) {
      throw new Error('Release database migrations are not contiguous');
    }
  }

  for (const [index, recorded] of applied.entries()) {
    if (recorded.version !== index + 1) {
      throw new Error('Database migration history is not contiguous');
    }

    const checksum = EXPECTED_MIGRATION_CHECKSUMS[index];

    if (checksum !== undefined && recorded.checksum !== checksum) {
      throw new Error(`Applied database migration ${recorded.version} changed`);
    }
  }
}

export async function readMigrationHistory(context: StoreContext): Promise<ReadonlyArray<MigrationRow>> {
  const result = await context.client.query('SELECT version,checksum FROM mechane.schema_migrations ORDER BY version');

  return Schema.decodeUnknownSync(Schema.Array(MigrationRow))(result.rows);
}

type RequiredSchemaRevision = { readonly context: StoreContext; readonly minimumVersion: number };

export async function requireSchemaRevision({ context, minimumVersion }: RequiredSchemaRevision): Promise<number> {
  const applied = await readMigrationHistory(context);

  validateAppliedMigrations(applied);

  if (applied.length < minimumVersion) {
    throw new Error('The database schema is missing a migration required by this release');
  }

  return applied.length;
}
