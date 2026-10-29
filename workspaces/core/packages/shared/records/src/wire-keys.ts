import { Record } from 'effect';
import type { Schema } from 'effect';
import type { WireKeys, WireStructInput } from './types.ts';
import { wireKey } from './wire-key.ts';

/**
 * Each field's wire key, as `wireKey` derives it. TypeScript types no string transform as a template literal type, so
 * the keys take `WireKeys`, which spells the same derivation for the compiler.
 */
export function wireKeys<const Fields extends Schema.Struct.Fields>({
  fields,
}: WireStructInput<Fields>): WireKeys<Fields> {
  // oxlint-disable-next-line consistent-type-assertions, no-unsafe-type-assertion -- TypeScript cannot infer WireKey
  return Record.map(fields, (_, field) => wireKey({ field })) as WireKeys<Fields>;
}
