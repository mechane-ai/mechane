import { Schema } from 'effect';

/** The fields of a list's query: `after`, the id of the last record a reader has. */
type ListQueryFields<Id extends Schema.Codec<string, string>> = {
  /** Absent at the list's start. */
  readonly after: Schema.OptionFromOptionalKey<Id>;
};

/** A list's query, which names the last record a reader has. */
type ListQuery<Id extends Schema.Codec<string, string>> = Schema.Struct<ListQueryFields<Id>>;

/** The schema of the id of a list's records, which its cursor names. */
type ListQueryInput<Id extends Schema.Codec<string, string>> = { readonly cursor: Id };

/** The query of a list that grows, which a reader pages through oldest first by the id its cursor names. */
export function listQuery<const Id extends Schema.Codec<string, string>>({
  cursor,
}: ListQueryInput<Id>): ListQuery<Id> {
  return Schema.Struct({
    /** The id of the last record a reader has, absent at the list's start. */
    after: Schema.OptionFromOptionalKey(cursor),
  });
}
