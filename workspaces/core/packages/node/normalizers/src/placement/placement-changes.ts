import type { FileChange } from '@mechane/checks-kernel';
import type { NormalizerScope, ParsedSource } from '@mechane/modules';
import { moveChanges } from './move-changes.ts';
import { roundMoves } from './round-moves.ts';

/** Every parsed file, the entries the manifests export, the files whose declarations may move, and the source roots. */
type PlacementChangesInput = {
  readonly sources: ReadonlyArray<ParsedSource>;
  readonly entries: ReadonlyMap<string, string>;
  readonly scope: NormalizerScope;
  readonly roots: ReadonlyArray<string>;
};

/**
 * One round of the placement normalizer: it moves every declaration under the scope that is not where it belongs. A
 * move changes the users of the names its declaration uses, so the next round reads the files this one leaves.
 */
export function placementChanges({ sources, entries, scope, roots }: PlacementChangesInput): ReadonlyArray<FileChange> {
  const { index, feasible } = roundMoves({ sources, entries, scope, roots });

  return moveChanges({ index, moves: feasible });
}
