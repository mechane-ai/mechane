import type { InputUnreadable, Site } from '@mechane/checks-kernel';
import { readText } from '@mechane/checks-kernel';
import { Effect } from 'effect';
import { ADAPTATIONS_HEADING, GLOSSARY } from './constants.ts';
import { phraseSites } from './phrase-sites.ts';
import { proseRuns } from './prose-runs.ts';
import type { BannedPhrase } from './types.ts';

/** The last cell of a glossary row, which lists the words its headword replaces. */
const REPLACED_CELL = /\|[^|\n]*\|$/gm;

/** A character of a cell other than its bars, which the glossary's own words blank to a space. */
const CELL_CHARACTER = /[^|]/g;

type ContractSitesInput = { readonly path: string; readonly phrases: ReadonlyArray<BannedPhrase> };

type ContractTextInput = { readonly path: string; readonly text: string };

/** The banned phrases of one contract's own words, from its local adaptations on, or all of it without any. */
export const contractSites = Effect.fn('contractSites')(function* ({
  path,
  phrases,
}: ContractSitesInput): Effect.fn.Return<ReadonlyArray<Site>, InputUnreadable> {
  const text = yield* readText({ path });
  const offset = Math.max(text.lastIndexOf(ADAPTATIONS_HEADING), 0);
  const runs = proseRuns({ text: ownWords({ path, text: text.slice(offset) }), offset });

  return phraseSites({ file: path, text, runs, phrases });
});

/**
 * A contract's own words. The glossary's last cell of each row lists the words its headword replaces, so it is blanked
 * to spaces, which keeps every other word at its offset.
 */
function ownWords({ path, text }: ContractTextInput): string {
  if (path !== GLOSSARY) {
    return text;
  }

  return text.replaceAll(REPLACED_CELL, (cell) => cell.replaceAll(CELL_CHARACTER, ' '));
}
