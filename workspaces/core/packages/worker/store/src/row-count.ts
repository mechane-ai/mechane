import { Schema } from 'effect';
import { decodeOne } from './decode-one.ts';
import type { StatementCursor } from './types.ts';

type RowCountInput = { readonly cursor: StatementCursor };

/** The one value a `COUNT(*) AS count` statement returns. */
const CountRow = Schema.Struct({ count: Schema.Int });

type CountRow = typeof CountRow.Type;

/** The count a `COUNT(*) AS count` statement returned. */
export function rowCount({ cursor }: RowCountInput): number {
  return decodeOne({ cursor, schema: CountRow }).count;
}
