import { Schema } from 'effect';
import type { CursorDecoding } from './types.ts';

/** Decodes every row of a cursor; a stored row that fails to decode is a defect, since only its store writes. */
export function decodeRows<S extends Schema.Codec<unknown, unknown>>({
  cursor,
  schema,
}: CursorDecoding<S>): ReadonlyArray<S['Type']> {
  return Schema.decodeUnknownSync(Schema.Array(schema))(cursor.toArray());
}
