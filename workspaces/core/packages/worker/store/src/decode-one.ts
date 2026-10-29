import { Schema } from 'effect';
import type { CursorDecoding } from './types.ts';

/**
 * Decodes the one row a statement returns, such as an aggregate's or a row its key names. A statement that returns
 * another count of rows, or a row that fails to decode, is a defect, since only its store writes.
 */
export function decodeOne<S extends Schema.Codec<unknown, unknown>>({ cursor, schema }: CursorDecoding<S>): S['Type'] {
  return Schema.decodeUnknownSync(schema)(cursor.one());
}
