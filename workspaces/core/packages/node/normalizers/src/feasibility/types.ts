import type { Move, PlacementIndex } from '@mechane/modules';

/** One round's index, a candidate move, and every candidate move of the round. */
export type FeasibleInput = {
  readonly index: PlacementIndex;
  readonly move: Move;
  readonly moves: ReadonlyArray<Move>;
};
