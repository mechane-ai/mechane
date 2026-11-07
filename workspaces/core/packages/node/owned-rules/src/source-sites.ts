import type { Site } from '@mechane/checks-kernel';
import type { ParsedSource } from '@mechane/modules';
import { Option } from 'effect';
import { HISTORY_WORDS } from './constants.ts';
import { docCommentSites } from './doc-comments/doc-comment-sites.ts';
import type { DocumentedExports } from './doc-comments/types.ts';
import { logicalOperatorSites } from './source/logical-operator-sites.ts';
import { spanNameSites } from './span-name-sites.ts';
import { historySites } from './vocabulary/history-sites.ts';
import { phraseSites } from './vocabulary/phrase-sites.ts';
import { sourceRuns } from './vocabulary/source-runs.ts';
import type { BannedPhrase } from './vocabulary/types.ts';

/** A parsed TypeScript file, and the glossary's banned phrases its names and comments may not hold. */
type SourceSitesInput = {
  readonly source: ParsedSource;
  readonly phrases: ReadonlyArray<BannedPhrase>;
  readonly documentation: DocumentedExports;
};

/**
 * Every owned site of one parsed TypeScript file: its one value, doc comments, span names, logical operators and banned
 * words.
 */
export function sourceSites({ source, phrases, documentation }: SourceSitesInput): ReadonlyArray<Site> {
  const { names, comments } = sourceRuns({ source });
  const { path: file, text } = source;
  const exports = documentation.get(file);
  const publicNames = Option.fromNullishOr(exports);
  const documented = Option.getOrElse(publicNames, () => new Set<string>());

  return [
    ...docCommentSites({ source, documented }),
    ...spanNameSites({ source }),
    ...logicalOperatorSites({ source }),
    ...phraseSites({ file, text, runs: [...names, ...comments], phrases }),
    ...historySites({ file, text, runs: names, historyWords: HISTORY_WORDS }),
  ];
}
