import type { InputUnreadable, Site } from '@mechane/checks-kernel';
import { standardMessage } from '@mechane/checks-kernel';
import type { ParsedSource } from '@mechane/modules';
import { Effect } from 'effect';
import { HISTORY_WORDS } from './constants.ts';
import { sourceSites } from './source-sites.ts';
import { bannedPhrases } from './vocabulary/banned-phrases.ts';
import { documentSites } from './vocabulary/document-sites.ts';

/** What the owned rules read: each TypeScript file of the source roots, parsed. */
type OwnedSitesInput = { readonly sources: ReadonlyArray<ParsedSource> };

/**
 * Every site of the owned rules: the one value, doc comments, span names, logical operators and banned words of each
 * parsed TypeScript file. The banned words of the documents that hold Mechane's own prose are sites too. Each message
 * ends with the rule of the standard the registry names for its rule.
 */
export const ownedSites = Effect.fn('ownedSites')(function* ({
  sources,
}: OwnedSitesInput): Effect.fn.Return<ReadonlyArray<Site>, InputUnreadable> {
  const phrases = yield* bannedPhrases();
  const documents = yield* documentSites({ phrases, historyWords: HISTORY_WORDS });
  const sites = sources.flatMap((source) => sourceSites({ source, phrases }));

  /** A site, its message ended with its rule's standard. */
  const standardSite: (site: Site) => Site = (site) => ({ ...site, message: standardMessage(site) });

  return [...sites, ...documents].map(standardSite);
});
