import { DateTime } from 'effect';
import { schemaRevision } from './schema-revision.ts';
import type { Migration } from './types.ts';

type ApplyMigrationsInput = { readonly sql: SqlStorage; readonly migrations: ReadonlyArray<Migration> };

/**
 * Applies every migration the database's ledger does not record, in order, recording each one's revision. The caller
 * runs it inside one transaction, so a database is never left between two revisions.
 */
export function applyMigrations({ sql, migrations }: ApplyMigrationsInput): void {
  const appliedAt = DateTime.nowUnsafe();

  sql.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (revision INTEGER PRIMARY KEY, applied_at_ms INTEGER NOT NULL) STRICT',
  );

  const applied = schemaRevision({ sql });

  for (const [offset, migrate] of migrations.slice(applied).entries()) {
    migrate({ sql });
    sql.exec(
      'INSERT INTO schema_migrations (revision, applied_at_ms) VALUES (?, ?)',
      applied + offset + 1,
      DateTime.toEpochMillis(appliedAt),
    );
  }
}
