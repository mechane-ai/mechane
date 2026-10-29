import { Array, Option, Record, Result, Schema } from 'effect';
import type { PageInput } from './types.ts';

/** The hidden fields of a page's form, which a browser posts back unchanged. */
const HIDDEN_FIELD = /<input type="hidden" name="([^"]+)" value="([^"]*)">/g;

/** One hidden field a page's form holds, as its pattern matches it: the whole field, its name, its value. */
const HiddenField = Schema.Tuple([Schema.String, Schema.String, Schema.String]);

type HiddenField = typeof HiddenField.Type;

/** A hidden field: its name and its value. */
type FieldEntry = readonly [string, string];

/** The hidden fields of a page's form, by name. */
export function formFields({ page }: PageInput): Readonly<Record<string, string>> {
  const field: (match: RegExpExecArray) => Option.Option<FieldEntry> = (match) =>
    Option.map(Result.getSuccess(Schema.decodeUnknownResult(HiddenField)(match)), ([, name, value]) => [name, value]);

  return Record.fromEntries(Array.getSomes([...page.text.matchAll(HIDDEN_FIELD)].map(field)));
}
