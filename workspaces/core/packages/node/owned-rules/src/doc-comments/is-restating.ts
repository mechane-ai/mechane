import { identifierWords } from '@mechane/program';
import type { Comment } from 'oxc-parser';
import { docText } from './doc-text.ts';

/** A run of the letters and digits a doc's words are made of, once the doc is lower case. */
const WORD = /[a-z0-9]+/g;

type IsRestatingInput = { readonly doc: Comment; readonly names: ReadonlyArray<string> };

/** Whether a doc holds only the words of a name it documents, such as `/** Start stack. *\/` above `startStack`. */
export function isRestating({ doc, names }: IsRestatingInput): boolean {
  const words = Array.from(docText({ doc }).toLowerCase().matchAll(WORD), ([word]) => word).join(' ');

  /** Whether the doc's words are the name's words. */
  const isNameWords: (identifier: string) => boolean = (identifier) =>
    identifierWords({ identifier }).join(' ') === words;

  return names.some(isNameWords);
}
