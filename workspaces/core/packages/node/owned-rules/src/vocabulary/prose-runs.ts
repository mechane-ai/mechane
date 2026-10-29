import { identifierWords } from '@mechane/program';
import type { WordRun } from './types.ts';

/** A clause of prose: the text between marks such as a period or a comma, across which no phrase continues. */
const CLAUSE = /[^.,;:!?()[\]{}<>|"]+/g;

/** A word of prose or code: letters and digits starting with a letter. */
const WORD = /[A-Za-z][A-Za-z0-9]*/g;

type ProseRunsInput = { readonly text: string; readonly offset: number };

/** The runs of prose from `offset`, one per clause, with each word of a code span split as an identifier's words. */
export function proseRuns({ text, offset }: ProseRunsInput): ReadonlyArray<WordRun> {
  /** One clause's run of words, at its offset in the text. */
  const clauseRun: (clause: RegExpExecArray) => WordRun = (clause) => ({
    words: Array.from(clause[0].matchAll(WORD), ([word]) => identifierWords({ identifier: word })).flat(),
    offset: offset + clause.index,
  });

  return Array.from(text.matchAll(CLAUSE), clauseRun);
}
