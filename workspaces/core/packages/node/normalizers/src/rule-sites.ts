import type { InputUnreadable, Site } from '@mechane/checks-kernel';
import { standardMessage } from '@mechane/checks-kernel';
import type { ParsedSource } from '@mechane/modules';
import { Normalizer } from '@mechane/rule-shapes';
import type { NormalizerRule } from '@mechane/rule-shapes';
import { gatedGlobs } from '@mechane/rules';
import { Effect } from 'effect';
import { barrelSites } from './barrels/barrel-sites.ts';
import { blankLineSites } from './blank-lines/blank-line-sites.ts';
import { placementSites } from './placement/placement-sites.ts';

/** One normalizer's rule, the entries the manifests export, every member's source roots, and every parsed file. */
type RuleSitesInput = {
  readonly rule: NormalizerRule;
  readonly entries: ReadonlyMap<string, string>;
  readonly roots: ReadonlyArray<string>;
  readonly sources: ReadonlyArray<ParsedSource>;
};

/**
 * One normalizer's sites over every file but those its behavior leaves to the live release verification, each message
 * ended with the rule of the standard its site's rule names.
 */
export const ruleSites = Effect.fn('ruleSites')(function* ({
  rule,
  entries,
  roots,
  sources,
}: RuleSitesInput): Effect.fn.Return<ReadonlyArray<Site>, InputUnreadable> {
  const sites = yield* bareSites({ rule, entries, roots, sources });

  /** A site, its message ended with its rule's standard. */
  const standardSite: (site: Site) => Site = (site) => ({ ...site, message: standardMessage(site) });

  return sites.map(standardSite);
});

/** The sites the normalizer reports, by its name, before their messages end with a rule of the standard. */
const bareSites = Effect.fn('bareSites')(function* ({
  rule,
  entries,
  roots,
  sources,
}: RuleSitesInput): Effect.fn.Return<ReadonlyArray<Site>, InputUnreadable> {
  const scope = { paths: [], excluded: gatedGlobs({ rule: rule.name }) };

  switch (rule.name) {
    case Normalizer.Placement:
      return placementSites({ sources, entries, scope, roots });
    case Normalizer.Barrels:
      return yield* barrelSites({ sources, entries, scope });
    case Normalizer.BlankLines:
      return blankLineSites({ sources, scope });
  }
});
