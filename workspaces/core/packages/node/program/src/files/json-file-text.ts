import { Schema } from 'effect';
import { JSON_INDENT_CHARS } from '../constants.ts';

type JsonFileTextInput<S extends Schema.Codec<unknown, unknown>> = { readonly schema: S; readonly value: S['Type'] };

/**
 * The text of a JSON file a program writes: the value encoded with its schema, indented two spaces a level, and a final
 * newline. The program built the value to the schema's type, so encoding it cannot fail.
 */
export function jsonFileText<S extends Schema.Codec<unknown, unknown>>({
  schema,
  value,
}: JsonFileTextInput<S>): string {
  return `${JSON.stringify(Schema.encodeSync(schema)(value), null, JSON_INDENT_CHARS)}\n`;
}
