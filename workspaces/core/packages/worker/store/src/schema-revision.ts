import { Schema } from 'effect';
import { decodeOne } from './decode-one.ts';
import type { RecordsInput } from './types.ts';

/** The highest revision `schema_migrations` records, 0 before the first migration. */
const RevisionRow = Schema.Struct({ revision: Schema.Int });

type RevisionRow = typeof RevisionRow.Type;

/** The count of migrations the database's ledger records, 0 before the first. */
export function schemaRevision({ sql }: RecordsInput): number {
  const cursor = sql.exec('SELECT COALESCE(MAX(revision), 0) AS revision FROM schema_migrations');

  return decodeOne({ cursor, schema: RevisionRow }).revision;
}
