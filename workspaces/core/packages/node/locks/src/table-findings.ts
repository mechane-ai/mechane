import { decodeFile } from '@mechane/checks-kernel';
import type { Finding, InputUnreadable } from '@mechane/checks-kernel';
import type { ParsedSource } from '@mechane/modules';
import { Array, Effect, Option, Schema } from 'effect';

/** The folder of every store, a `store` folder or a `*-store` package, whose files alone create tables. */
const STORE_SEGMENT = /\/(?:[\w-]+-)?store\//;

/** The ast-grep rule that lists the stored names, whose tables the migrations create. */
const STORED_NAME_RULE = 'lint/ast-grep/rules/stored-name-outside-store.yml';

/** A table a store creates, in a migration or in the ledger every store shares. */
const CREATED_TABLE = /CREATE TABLE (?:IF NOT EXISTS )?(\w+)/g;

/** The table names of the stored-name rule's SQL pattern, the alternation inside its second group. */
const RULE_TABLES = /\\s\+\(([\w|]+)\)\\b/;

/** The group of `RULE_TABLES` that holds the alternation of table names. */
const TABLES_GROUP = 1;

/** The stored-name rule's patterns, of which the first names the tables in SQL text. */
const StoredNameRule = Schema.Struct({
  rule: Schema.Struct({ any: Schema.NonEmptyArray(Schema.Struct({ regex: Schema.String })) }),
});

type CreatedTablesInput = { readonly text: string };

/** Every parsed file of the members, among which the stores' files declare their schema steps. */
type TableFindingsInput = { readonly sources: ReadonlyArray<ParsedSource> };

/**
 * Checks that the stored-name rule's SQL pattern names each table a store creates, and no other, so the rule follows
 * the migrations as they rename or add a table.
 */
export const tableFindings = Effect.fn('tableFindings')(function* ({
  sources,
}: TableFindingsInput): Effect.fn.Return<ReadonlyArray<Finding>, InputUnreadable> {
  const stores = sources.filter(({ path }) => STORE_SEGMENT.test(path));
  const created = new Set(stores.flatMap(({ text }) => createdTables({ text })));
  const { rule } = yield* decodeFile({ path: STORED_NAME_RULE, schema: StoredNameRule });

  const alternation = Option.flatMap(Option.fromNullishOr(RULE_TABLES.exec(rule.any[0].regex)), (groups) =>
    Array.get(groups, TABLES_GROUP),
  );

  const named = new Set(
    Option.getOrElse(
      Option.map(alternation, (tables) => tables.split('|')),
      () => [],
    ),
  );

  const unnamedMessage: (table: string) => string = (table) =>
    `Add the table ${table} to the rule's pattern, such as \`|${table}\``;

  const uncreatedMessage: (table: string) => string = (table) =>
    `Remove ${table} from the rule's pattern, such as \`|${table}\`, since no store creates it`;

  const messages = [
    ...Array.difference(created, named).map(unnamedMessage),
    ...Array.difference(named, created).map(uncreatedMessage),
  ];

  return messages.map((message) => ({ check: 'locks', location: STORED_NAME_RULE, message }));
});

/** The tables the text creates, by name. */
function createdTables({ text }: CreatedTablesInput): ReadonlyArray<string> {
  /** The table one `CREATE TABLE` names. */
  const createdTable: (match: RegExpExecArray) => ReadonlyArray<string> = ([, table]) =>
    Option.toArray(Option.fromUndefinedOr(table));

  return [...text.matchAll(CREATED_TABLE)].flatMap(createdTable);
}
