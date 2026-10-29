import type { InputUnreadable, Member, Site } from '@mechane/checks-kernel';
import type { ParsedSource } from '@mechane/modules';
import type { NormalizerRule } from '@mechane/rule-shapes';
import { Effect } from 'effect';
import { entryFiles } from './entry-files.ts';
import { ruleSites } from './rule-sites.ts';

/** The normalizers' rules, and the members with every parsed file of theirs. */
type NormalizerSitesInput = {
  readonly rules: ReadonlyArray<NormalizerRule>;
  readonly members: ReadonlyArray<Member>;
  readonly sources: ReadonlyArray<ParsedSource>;
};

/**
 * Each site the normalizers of `rules` rewrite in their next run, by each rule's name, which the owned checks hold as
 * findings. The placement normalizer's sites are the declarations it moves, the barrel normalizer's the files, and the
 * blank-lines normalizer's the lines it sets apart.
 */
export const normalizerSites = Effect.fn('normalizerSites')(function* ({
  rules,
  members,
  sources,
}: NormalizerSitesInput): Effect.fn.Return<ReadonlyArray<Site>, InputUnreadable> {
  const entries = yield* entryFiles({ members });
  const roots = members.flatMap(({ sourceRoots }) => sourceRoots);

  const groups = yield* Effect.forEach(rules, (rule) => ruleSites({ rule, entries, roots, sources }), {
    concurrency: 1,
  });

  return groups.flat();
});
