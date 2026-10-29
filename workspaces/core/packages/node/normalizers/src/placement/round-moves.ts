import { inScope, placementIndex, unitMoves } from '@mechane/modules';
import type { Move, NormalizerScope, ParsedSource, PlacementIndex } from '@mechane/modules';
import { feasibleMoves } from '../feasibility/feasible-moves.ts';

/** Every parsed file, the entries the manifests export, the files whose declarations may move, and the source roots. */
type RoundMovesInput = {
  readonly sources: ReadonlyArray<ParsedSource>;
  readonly entries: ReadonlyMap<string, string>;
  readonly scope: NormalizerScope;
  readonly roots: ReadonlyArray<string>;
};

/** What one round reads, the moves it makes, and those it leaves: each the scope excludes, and each it cannot make. */
type RoundMoves = {
  readonly index: PlacementIndex;
  readonly feasible: ReadonlyArray<Move>;
  readonly gated: ReadonlyArray<Move>;
  readonly infeasible: ReadonlyArray<Move>;
};

/** A candidate move, and the globs of the files the normalizer leaves as they are. */
type IsGatedInput = { readonly move: Move; readonly excluded: ReadonlyArray<string> };

/**
 * What one round of the placement normalizer decides. Each declaration under the scope's paths that is not where it
 * belongs is a candidate. A candidate from or into an excluded file waits for a person, and each other moves when it
 * can.
 */
export function roundMoves({ sources, entries, scope, roots }: RoundMovesInput): RoundMoves {
  const index = placementIndex({ sources, entries });
  const candidates = unitMoves({ index, paths: scope.paths, roots });
  const gated: ReadonlySet<Move> = new Set(candidates.filter((move) => isGated({ move, excluded: scope.excluded })));
  /** Whether the scope leaves the move open. */
  const isOpen: (move: Move) => boolean = (move) => !gated.has(move);
  const open = candidates.filter(isOpen);
  const feasible = feasibleMoves({ index, moves: open, allowCycles: false });
  const made: ReadonlySet<Move> = new Set(feasible);

  /** Whether the round leaves the open move. */
  const isLeft: (move: Move) => boolean = (move) => !made.has(move);

  return { index, feasible, gated: [...gated], infeasible: open.filter(isLeft) };
}

/**
 * Whether a move leaves or enters a file an excluded glob matches, such as code only the live release verification
 * reaches.
 */
function isGated({ move, excluded }: IsGatedInput): boolean {
  /** Whether an excluded glob matches the file. */
  const isExcluded: (path: string) => boolean = (path) => !inScope({ path, scope: { paths: [], excluded } });

  return [move.unit.path, move.to].some(isExcluded);
}
