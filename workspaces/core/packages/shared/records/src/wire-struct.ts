import { Schema } from 'effect';
import type { WireKeys, WireStructInput } from './types.ts';
import { wireKeys } from './wire-keys.ts';

/** A struct whose wire keys derive from its fields. */
type WireStruct<Fields extends Schema.Struct.Fields> = Schema.encodeKeys<Schema.Struct<Fields>, WireKeys<Fields>>;

/**
 * A struct whose wire keys derive from its fields, as `wireKey` derives them, so no key map restates the fields:
 * `startedAt` travels as `started_at`, and `isSelfGrading` as `self_grading`.
 */
export function wireStruct<const Fields extends Schema.Struct.Fields>({
  fields,
}: WireStructInput<Fields>): WireStruct<Fields> {
  return Schema.Struct(fields).pipe(Schema.encodeKeys(wireKeys({ fields })));
}
