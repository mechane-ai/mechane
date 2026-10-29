import { Array, Effect } from 'effect';
import { WORKSPACE_FOLDER } from '../constants.ts';
import type { InputUnreadable } from '../errors.ts';
import { standardMessage } from '../standard-message.ts';
import type { Site } from '../types.ts';
import { astGrepSites } from './ast-grep-sites.ts';
import { oxlintSites } from './oxlint-sites.ts';

/** The files a command lints, every file of the workspace when it names none, and the variables linters inherit. */
type LintSitesInput = { readonly paths: ReadonlyArray<string>; readonly inherited: Readonly<Record<string, string>> };

/**
 * Lints `paths`, or the whole workspace when the command names none, with oxlint and then with ast-grep. An installed
 * rule's message, which the library writes, ends with its rule of the standard, as AS-01 says.
 */
export const lintSites = Effect.fn('lintSites')(function* ({
  paths,
  inherited,
}: LintSitesInput): Effect.fn.Return<ReadonlyArray<Site>, InputUnreadable> {
  const targets = Array.match(paths, { onEmpty: () => [WORKSPACE_FOLDER], onNonEmpty: (named) => named });
  const oxlint = yield* oxlintSites({ targets, inherited });
  const astGrep = yield* astGrepSites({ targets, inherited });

  /** A site, its message ended with its rule's standard. */
  const standardSite: (site: Site) => Site = (site) => ({ ...site, message: standardMessage(site) });

  return [...oxlint, ...astGrep].map(standardSite);
});
