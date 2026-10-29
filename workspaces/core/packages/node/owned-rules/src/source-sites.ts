import type { Site } from '@mechane/checks-kernel';
import type { ParsedSource } from '@mechane/modules';
import { HISTORY_WORDS } from './constants.ts';
import { docCommentSites } from './doc-comments/doc-comment-sites.ts';
import { oneValueSites } from './layout/one-value-sites.ts';
import { logicalOperatorSites } from './source/logical-operator-sites.ts';
import { spanNameSites } from './span-name-sites.ts';
import { historySites } from './vocabulary/history-sites.ts';
import { phraseSites } from './vocabulary/phrase-sites.ts';
import { sourceRuns } from './vocabulary/source-runs.ts';
import type { BannedPhrase } from './vocabulary/types.ts';

/** A parsed TypeScript file, and the glossary's banned phrases its names and comments may not hold. */
type SourceSitesInput = { readonly source: ParsedSource; readonly phrases: ReadonlyArray<BannedPhrase> };

/**
 * Every owned site of one parsed TypeScript file: its one value, doc comments, span names, logical operators and banned
 * words.
 */
export function sourceSites({ source, phrases }: SourceSitesInput): ReadonlyArray<Site> {
  const { names, comments } = sourceRuns({ source });
  const { path: file, text } = source;

  return [
    ...oneValueSites({ source }),
    ...docCommentSites({ source }),
    ...spanNameSites({ source }),
    ...logicalOperatorSites({ source }),
    ...phraseSites({ file, text, runs: [...names, ...comments], phrases }),
    ...historySites({ file, text, runs: names, historyWords: HISTORY_WORDS }),
  ];
}
