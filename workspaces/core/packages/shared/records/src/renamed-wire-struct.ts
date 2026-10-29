import { Schema } from 'effect';
import type { WireKeys } from './types.ts';
import { wireKeys } from './wire-keys.ts';

/** Keys the derivation cannot produce, such as another system's, by the field each one carries. */
type WireRenames<Fields extends Schema.Struct.Fields, Renames> = {
  readonly [Field in keyof Renames]: Field extends keyof Fields ? string : never;
};

/** Each field's wire key: its rename, or the key `wireKey` derives. */
type RenamedWireKeys<Fields extends Schema.Struct.Fields, Renames extends WireRenames<Fields, Renames>> = Omit<
  WireKeys<Fields>,
  keyof Renames
> &
  Renames;

/** A struct whose wire keys derive from its fields, except the renamed ones. */
type RenamedWireStruct<
  Fields extends Schema.Struct.Fields,
  Renames extends WireRenames<Fields, Renames>,
> = Schema.encodeKeys<Schema.Struct<Fields>, RenamedWireKeys<Fields, Renames>>;

/** The fields of a wire struct, and the keys among them the derivation cannot produce. */
type RenamedWireStructInput<Fields extends Schema.Struct.Fields, Renames> = {
  readonly fields: Fields;
  readonly renames: Renames;
};

/**
 * A struct whose wire keys derive from its fields, as `wireKey` derives them, except the keys in `renames`. Each one is
 * a key the derivation cannot produce, such as another system's name for a field.
 */
export function renamedWireStruct<
  const Fields extends Schema.Struct.Fields,
  const Renames extends WireRenames<Fields, Renames>,
>({ fields, renames }: RenamedWireStructInput<Fields, Renames>): RenamedWireStruct<Fields, Renames> {
  return Schema.Struct(fields).pipe(
    Schema.encodeKeys<Schema.Struct<Fields>, RenamedWireKeys<Fields, Renames>>({ ...wireKeys({ fields }), ...renames }),
  );
}
