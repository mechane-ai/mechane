import { Schema } from 'effect';
import type { Array } from 'effect';
import type { CursorDecoding } from './types.ts';

/**
 * Decodes every row of a cursor that its store's invariant keeps from being empty, such as a principal's workspaces. An
 * empty cursor, or a stored row that fails to decode, is a defect, since only its store writes.
 */
export function decodeNonEmptyRows<S extends Schema.Codec<unknown, unknown>>({
  cursor,
  schema,
}: CursorDecoding<S>): Array.NonEmptyReadonlyArray<S['Type']> {
  return Schema.decodeUnknownSync(Schema.NonEmptyArray(schema))(cursor.toArray());
}
