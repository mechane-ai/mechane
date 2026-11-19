import type { Option } from 'effect';
import { Schema } from 'effect';

type StoredValue<S> = { readonly value: unknown; readonly schema: S };

/** An absent KV key is empty. An existing authoritative record with unknown contents is a storage failure. */
export function decodeOptionalStoredValue<S extends Schema.Codec<unknown, unknown>>({
  value,
  schema,
}: StoredValue<S>): Option.Option<S['Type']> {
  const optional = Schema.OptionFromUndefinedOr(schema);

  return Schema.decodeUnknownSync(optional)(value);
}
