import type { Site } from '@mechane/checks-kernel';
import { lineAt } from '@mechane/modules';
import { BANNED_WORDS_RULE } from './constants.ts';
import { runPhrases } from './run-phrases.ts';
import type { BannedPhrase, FoundPhrase, WordRun } from './types.ts';

type PhraseSitesInput = {
  readonly file: string;
  readonly text: string;
  readonly runs: ReadonlyArray<WordRun>;
  readonly phrases: ReadonlyArray<BannedPhrase>;
};

/** Each occurrence of a banned phrase in the runs of one file, as a site on the line its run starts on. */
export function phraseSites({ file, text, runs, phrases }: PhraseSitesInput): ReadonlyArray<Site> {
  const byFirstWord = Map.groupBy(phrases, ({ first }) => first);

  /** The site of a banned phrase found in a run. */
  const phraseSite: (found: FoundPhrase) => Site = ({ offset, phrase: { phrase, headword } }) => ({
    rule: BANNED_WORDS_RULE,
    file,
    line: lineAt({ text, offset }),
    message: `Replace \`${phrase}\` with the glossary's word, such as \`${headword}\``,
  });

  return runs.flatMap((run) => runPhrases({ run, byFirstWord })).map(phraseSite);
}
