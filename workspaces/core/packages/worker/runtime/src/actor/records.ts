import { Schema } from 'effect';

export function decodeStored<T>(schema: Schema.Codec<T, unknown>, value: string): T {
  return Schema.decodeUnknownSync(schema)(JSON.parse(value));
}
