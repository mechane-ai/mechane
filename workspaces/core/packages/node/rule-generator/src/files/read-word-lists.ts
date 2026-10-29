import { WordList } from '@mechane/rule-shapes';
import { wordListPath } from '@mechane/rules';
import type { WordLists } from '@mechane/rules';
import { Effect } from 'effect';
import type { GenerateFailed } from '../errors.ts';
import { readInput } from './read-input.ts';

type ReadWordListInput = { readonly list: WordList };

/** Every word list of the registry's vocabulary, each as the words of its file's lines. */
export const readWordLists = Effect.fn('readWordLists')(function* (): Effect.fn.Return<WordLists, GenerateFailed> {
  return yield* Effect.all(
    {
      units: readWordList({ list: WordList.Units }),
      countedNouns: readWordList({ list: WordList.CountedNouns }),
      acronyms: readWordList({ list: WordList.Acronyms }),
    },
    { concurrency: 1 },
  );
});

/** One word list's words, from its file of one word per line. */
const readWordList = Effect.fn('readWordList')(function* ({
  list,
}: ReadWordListInput): Effect.fn.Return<ReadonlyArray<string>, GenerateFailed> {
  const text = yield* readInput({ path: wordListPath({ list }) });

  return text.split('\n').filter((line) => line !== '');
});
