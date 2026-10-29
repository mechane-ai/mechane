import { Array } from 'effect';
import type { Option, Schema } from 'effect';
import { decodeRows } from './decode-rows.ts';
import type { CursorDecoding } from './types.ts';

/** Decodes the first row of a cursor, none when it holds none; a stored row that fails to decode is a defect. */
export function decodeFirst<S extends Schema.Codec<unknown, unknown>>({
  cursor,
  schema,
}: CursorDecoding<S>): Option.Option<S['Type']> {
  return Array.head(decodeRows({ cursor, schema }));
}
