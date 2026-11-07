import type { Schema } from 'effect';
import type { BOOLEAN_PREFIXES } from './constants.ts';
/** A closed set as its declaration names it: each member's name and its value on the wire. */
export type ClosedSet = Readonly<Record<string, string>>;

/** The closed set whose members a schema reads. */
export type ClosedSetInput<S extends ClosedSet = ClosedSet> = { readonly set: S };

/** The schema of text that names no member of a closed set, under the brand every unknown member shares. */
export type UnknownMemberSchema = Schema.brand<Schema.String, 'UnknownMember'>;

/** A camelCase name in snake_case: each capital letter becomes `_` and its lowercase. */
type SnakeCase<Name extends string> = Name extends `${infer Letter}${infer Rest}`
  ? `${Letter extends Lowercase<Letter> ? Letter : `_${Lowercase<Letter>}`}${SnakeCase<Rest>}`
  : Name;

/** A field without the boolean prefix before its next word's capital letter: `selfGrading` for `isSelfGrading`. */
type Unprefixed<Field extends string> = Field extends `${(typeof BOOLEAN_PREFIXES)[number]}${infer Rest}`
  ? Rest extends `${infer Letter}${string}`
    ? Letter extends Lowercase<Letter>
      ? Field
      : Uncapitalize<Rest>
    : Field
  : Field;

/** The key under which the wire carries a field, as `wireKey` derives it. */
export type WireKey<Field extends string> = SnakeCase<Unprefixed<Field>>;

/** Each field's wire key, as `wireKey` derives it. */
export type WireKeys<Fields extends Schema.Struct.Fields> = {
  readonly [Field in keyof Fields]: Field extends string ? WireKey<Field> : Field;
};

/** The fields of a wire struct. */
export type WireStructInput<Fields extends Schema.Struct.Fields> = { readonly fields: Fields };
