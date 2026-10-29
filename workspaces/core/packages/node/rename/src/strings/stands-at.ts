import { wordPattern } from '../word-pattern.ts';

/** A text, a word, and the offset where it may stand. */
type StandsAtInput = { readonly text: string; readonly word: string; readonly offset: number };

/** Whether the word stands whole at the offset, as an earlier run of the map left it. */
export function standsAt({ text, word, offset }: StandsAtInput): boolean {
  const pattern = new RegExp(wordPattern({ text: word }).source, 'y');

  pattern.lastIndex = offset;

  return pattern.test(text);
}
