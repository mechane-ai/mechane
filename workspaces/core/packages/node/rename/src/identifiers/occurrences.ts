import { wordPattern } from '../word-pattern.ts';

/** A file's text, and the name to find. */
type OccurrencesInput = { readonly text: string; readonly name: string };

/** Where a whole word starts in a text: its zero-based line and UTF-16 character. */
type Occurrence = { readonly line: number; readonly character: number };

/** Where the name stands as a whole word in the text, with no identifier character on either side. */
export function occurrences({ text, name }: OccurrencesInput): ReadonlyArray<Occurrence> {
  /** The name's occurrences on the line at the index. */
  const lineOccurrences: (line: string, index: number) => ReadonlyArray<Occurrence> = (line, index) =>
    [...line.matchAll(wordPattern({ text: name }))].map((match) => ({ line: index, character: match.index }));

  return text.split('\n').flatMap(lineOccurrences);
}
