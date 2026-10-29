import type { InputUnreadable } from '@mechane/checks-kernel';
import { readText } from '@mechane/checks-kernel';
import { Array, Effect, Option } from 'effect';
import { ADAPTATIONS_HEADING, GLOSSARY } from './constants.ts';
import { replacedPhrase } from './replaced-phrase.ts';
import type { BannedPhrase } from './types.ts';

/**
 * The scope that limits a replaced word to one concept, such as `(for this concept)`; the glossary's reclassification
 * removes every one, and until then such a cell bans nothing.
 */
const CONCEPT_SCOPE = '(for ';

/** The cell of a glossary row, split at its bars, that holds the headword. */
const HEADWORD_CELL = 1;

/** The cell of a glossary row that lists the words its headword replaces. */
const REPLACED_CELL = 3;

/** The row that rules off a Markdown table's header from its body. */
const TABLE_RULE = '| ---';

/** The opening of a row of a Markdown table. */
const TABLE_ROW = '| ';

type GlossaryRowInput = { readonly row: string };

/** The banned phrases of one row: its replaced words, split at commas, but each that a concept scope narrows. */
function rowPhrases({ row }: GlossaryRowInput): ReadonlyArray<BannedPhrase> {
  const cells = row.split('|').map((cell) => cell.trim());
  const headword = Array.get(cells, HEADWORD_CELL);
  const replaces = Array.get(cells, REPLACED_CELL);

  if (Option.isNone(headword) || Option.isNone(replaces)) {
    return [];
  }

  /** Whether no concept scope narrows the replaced word. */
  const isUnscoped: (replaced: string) => boolean = (replaced) => !replaced.includes(CONCEPT_SCOPE);

  return replaces.value
    .split(',')
    .filter(isUnscoped)
    .flatMap((replaced) => replacedPhrase({ replaced, headword: headword.value }));
}

/**
 * The banned phrases of the glossary's table: each synonym of two or more words that a row replaces without a concept
 * scope. A replaced single word stays allowed until the glossary's reclassification decides it.
 */
export const bannedPhrases = Effect.fn('bannedPhrases')(function* (): Effect.fn.Return<
  ReadonlyArray<BannedPhrase>,
  InputUnreadable
> {
  const text = yield* readText({ path: GLOSSARY });
  const lines = text.slice(text.lastIndexOf(ADAPTATIONS_HEADING)).split('\n');
  const rows = lines.slice(lines.findIndex((line) => line.startsWith(TABLE_RULE)) + 1);

  return rows.filter((row) => row.startsWith(TABLE_ROW)).flatMap((row) => rowPhrases({ row }));
});
