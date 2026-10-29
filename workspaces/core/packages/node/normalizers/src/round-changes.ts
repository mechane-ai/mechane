import type { FileChange, InputUnreadable } from '@mechane/checks-kernel';
import type { NormalizerScope, ParsedSource } from '@mechane/modules';
import { Normalizer } from '@mechane/rule-shapes';
import { Effect } from 'effect';
import { barrelChanges } from './barrels/barrel-changes.ts';
import { blankLineChanges } from './blank-lines/blank-line-changes.ts';
import { placementChanges } from './placement/placement-changes.ts';

/** A normalizer, the files a round reads, the manifests' entries, the source roots, and the files it rewrites. */
type RoundChangesInput = {
  readonly normalizer: Normalizer;
  readonly sources: ReadonlyArray<ParsedSource>;
  readonly entries: ReadonlyMap<string, string>;
  readonly roots: ReadonlyArray<string>;
  readonly scope: NormalizerScope;
};

/** What one round of the normalizer changes. */
export const roundChanges = Effect.fn('roundChanges')(function* ({
  normalizer,
  sources,
  entries,
  roots,
  scope,
}: RoundChangesInput): Effect.fn.Return<ReadonlyArray<FileChange>, InputUnreadable> {
  switch (normalizer) {
    case Normalizer.Placement:
      return placementChanges({ sources, entries, scope, roots });
    case Normalizer.Barrels:
      return yield* barrelChanges({ sources, entries, scope });
    case Normalizer.BlankLines:
      return blankLineChanges({ sources, scope });
  }
});
