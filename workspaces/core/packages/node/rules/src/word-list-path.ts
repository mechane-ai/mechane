import type { WordList } from '@mechane/rule-shapes';
import { posix } from 'node:path';
import { VOCABULARY_FOLDER } from './constants.ts';

/** One of the registry's word lists. */
type WordListPathInput = { readonly list: WordList };

/** A word list's file, relative to the workspace: its sorted words, one per line. */
export function wordListPath({ list }: WordListPathInput): string {
  return posix.join(VOCABULARY_FOLDER, `${list}.txt`);
}
