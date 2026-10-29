import type { OwnedExample } from '@mechane/rule-shapes';
import { Record } from 'effect';

/** An owned rule's or a normalizer's example tree. */
type ExampleTextInput = { readonly example: OwnedExample };

/** An owned rule's or a normalizer's example on one line: each file's path and its text as a string literal. */
export function exampleText({ example }: ExampleTextInput): string {
  const fileText: (file: readonly [string, string]) => string = ([path, text]) => `${path} ${JSON.stringify(text)}`;

  return Record.toEntries(example).map(fileText).join('; ');
}
