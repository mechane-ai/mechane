import type { Option } from 'effect';
import { Result, Schema } from 'effect';

type CacheDecoding<S extends Schema.Codec<unknown, unknown>> = { readonly value: unknown; readonly schema: S };

/** Missing or incompatible disposable cache metadata is a miss, never authoritative data loss. */
export function decodeCache<S extends Schema.Codec<unknown, unknown>>({
  value,
  schema,
}: CacheDecoding<S>): Option.Option<S['Type']> {
  const decoded = Schema.decodeUnknownResult(schema)(value);

  return Result.getSuccess(decoded);
}
