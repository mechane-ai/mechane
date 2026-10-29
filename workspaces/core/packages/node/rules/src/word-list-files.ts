import { WordList } from '@mechane/rule-shapes';
import type { GeneratedFile, WordLists } from './types.ts';
import { wordListPath } from './word-list-path.ts';

type WordListFilesInput = { readonly wordLists: WordLists };

/** One word list, and the words it holds. */
type ListedWords = { readonly list: WordList; readonly words: ReadonlyArray<string> };

/**
 * Each word list as the registry keeps it: its words sorted, each once, one per line. A merge unites two sides' lines,
 * and `mise run fix` then sorts them again.
 */
export function wordListFiles({ wordLists }: WordListFilesInput): ReadonlyArray<GeneratedFile> {
  const wordListFile: (listed: ListedWords) => GeneratedFile = ({ list, words }) => ({
    path: wordListPath({ list }),
    text: [...[...new Set(words)].toSorted(), ''].join('\n'),
  });

  const lists: ReadonlyArray<ListedWords> = [
    { list: WordList.Units, words: wordLists.units },
    { list: WordList.CountedNouns, words: wordLists.countedNouns },
    { list: WordList.Acronyms, words: wordLists.acronyms },
  ];

  return lists.map(wordListFile);
}
