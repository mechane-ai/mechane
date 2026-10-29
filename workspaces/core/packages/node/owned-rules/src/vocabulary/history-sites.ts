import type { Site } from '@mechane/checks-kernel';
import { lineAt } from '@mechane/modules';
import { BANNED_WORDS_RULE } from './constants.ts';
import type { WordRun } from './types.ts';

/** The runs of one file's names, and the history words none of them holds. */
type HistorySitesInput = {
  readonly file: string;
  readonly text: string;
  readonly runs: ReadonlyArray<WordRun>;
  readonly historyWords: ReadonlySet<string>;
};

/** Each history word in the name runs of one file, as a site on the line its run starts on: a name says what it is. */
export function historySites({ file, text, runs, historyWords }: HistorySitesInput): ReadonlyArray<Site> {
  /** The sites of each history word one run holds. */
  const runSites: (run: WordRun) => ReadonlyArray<Site> = ({ words, offset }) => {
    const line = lineAt({ text, offset });

    /** The site of one history word. */
    const historySite: (word: string) => Site = (word) => ({
      rule: BANNED_WORDS_RULE,
      file,
      line,
      message: `Name what it holds instead of when it came, such as \`activeTurns\` in place of \`${word}Turns\``,
    });

    return words.filter((word) => historyWords.has(word)).map(historySite);
  };

  return runs.flatMap(runSites);
}
