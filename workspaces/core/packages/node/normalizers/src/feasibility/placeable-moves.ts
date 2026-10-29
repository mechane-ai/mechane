import type { Move, PlacementIndex } from '@mechane/modules';
import { acyclicMoves } from '../graph/acyclic-moves.ts';
import { isFeasible } from './is-feasible.ts';

/** One round's index, its candidate moves, and whether a move may close a cycle of imports. */
type PlaceableMovesInput = {
  readonly index: PlacementIndex;
  readonly moves: ReadonlyArray<Move>;
  /** True for a package step, whose rounds only its end state must keep acyclic. */
  readonly allowCycles: boolean;
};

/** The moves that reach every binding they need, whatever moves elsewhere, repeated until none drops. */
export function placeableMoves({ index, moves, allowCycles }: PlaceableMovesInput): ReadonlyArray<Move> {
  let current = moves;
  let placeable = placeableRound({ index, moves: current, allowCycles });

  while (placeable.length !== current.length) {
    current = placeable;
    placeable = placeableRound({ index, moves: current, allowCycles });
  }

  return current;
}

/** One pass: the moves that reach every binding among the candidates, then those of them that close no cycle. */
function placeableRound({ index, moves, allowCycles }: PlaceableMovesInput): ReadonlyArray<Move> {
  const bound = moves.filter((move) => isFeasible({ index, move, moves }));

  if (allowCycles) {
    return bound;
  }

  return acyclicMoves({ index, moves: bound });
}
