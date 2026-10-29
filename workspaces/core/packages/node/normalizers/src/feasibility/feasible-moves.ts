import type { Move, PlacementIndex } from '@mechane/modules';
import { isStranded } from './is-stranded.ts';
import { placeableMoves } from './placeable-moves.ts';

/** One round's index, its candidate moves, and whether a move may close a cycle of imports. */
type FeasibilityInput = {
  readonly index: PlacementIndex;
  readonly moves: ReadonlyArray<Move>;
  /** True for a package step, whose rounds only its end state must keep acyclic, as the check holds it. */
  readonly allowCycles: boolean;
};

/** The placeable moves of a pass, and those of them no move strands. */
type FeasibleRound = { readonly placeable: ReadonlyArray<Move>; readonly kept: ReadonlyArray<Move> };

/**
 * The moves whose units reach every binding they need where they land, with no name there bound to something else and,
 * unless cycles are allowed, no cycle of imports closed. A move that drops out can strand another, so the check repeats
 * until none drops. Only a placeable move strands another, and a carried unit moves only with each unit that carries
 * it.
 */
export function feasibleMoves({ index, moves, allowCycles }: FeasibilityInput): ReadonlyArray<Move> {
  let round = feasibleRound({ index, moves, allowCycles });

  while (round.kept.length < round.placeable.length) {
    round = feasibleRound({ index, moves: round.kept, allowCycles });
  }

  return round.placeable;
}

/** One pass of the check: the moves placeable among the candidates, and those of them no move strands. */
function feasibleRound({ index, moves, allowCycles }: FeasibilityInput): FeasibleRound {
  const placeable = placeableMoves({ index, moves, allowCycles });

  /** Whether no other placeable move strands the move. */
  const isKept: (move: Move) => boolean = (move) => !isStranded({ index, move, moves: placeable });

  return { placeable, kept: placeable.filter(isKept) };
}
