import { Array, Option } from 'effect';
import type { BannedPhrase, FoundPhrase, WordRun } from './types.ts';

/** A run of words, and the banned phrases by the first word of each. */
type RunPhrasesInput = {
  readonly run: WordRun;
  readonly byFirstWord: ReadonlyMap<string, ReadonlyArray<BannedPhrase>>;
};

type MatchesInput = { readonly words: ReadonlyArray<string>; readonly start: number; readonly phrase: BannedPhrase };

/** Each banned phrase that starts at a word of the run, with the offset of the run. */
export function runPhrases({ run, byFirstWord }: RunPhrasesInput): ReadonlyArray<FoundPhrase> {
  const { words, offset } = run;

  /** The banned phrases that start at the word at `start`. */
  const startPhrases: (word: string, start: number) => ReadonlyArray<FoundPhrase> = (word, start) => {
    const candidates = Option.getOrElse(Option.fromNullishOr(byFirstWord.get(word)), () => []);

    return candidates.filter((phrase) => matches({ words, start, phrase })).map((phrase) => ({ offset, phrase }));
  };

  return words.flatMap(startPhrases);
}

/** Whether the rest of a phrase follows its first word at `start`, its last word also as a plural that adds an `s`. */
function matches({ words, start, phrase }: MatchesInput): boolean {
  /** Whether the run holds the phrase's word at its place after the first. */
  const isFollowed: (word: string, index: number) => boolean = (word, index) => {
    const found = Array.get(words, start + 1 + index);
    const isLast = index === phrase.rest.length - 1;

    return Option.contains(found, word) || (isLast && Option.contains(found, `${word}s`));
  };

  return phrase.rest.every(isFollowed);
}
