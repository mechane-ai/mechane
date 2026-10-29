import { BlockerKind, originKey, unitNeeds } from '@mechane/modules';
import type { Blocker, Move, Need, TopLevelName } from '@mechane/modules';
import { Option } from 'effect';
import { acyclicMoves } from '../graph/acyclic-moves.ts';
import { isDeclaredInOrder } from './is-declared-in-order.ts';
import { isExportedAsNeeded } from './is-exported-as-needed.ts';
import { isOrdered } from './is-ordered.ts';
import type { FeasibleInput } from './types.ts';

/** A need of a candidate move, the move, and the moves its round makes. */
type IsHiddenInput = { readonly need: Need; readonly move: Move; readonly moves: ReadonlyArray<Move> };

/**
 * Why a candidate move stays out of a round that makes `moves`. Its checks decide in order: a cycle it would close, a
 * need its file does not export, the role order, its landing, and else a binding there.
 */
export function moveBlocker({ index, move, moves }: FeasibleInput): Blocker {
  const round = [...moves, move];
  const needs = unitNeeds({ index, move });
  const hidden = needs.filter((need) => isHidden({ need, move, moves })).map(({ local }) => local);

  if (!acyclicMoves({ index, moves: round }).includes(move)) {
    return { kind: BlockerKind.Cycle };
  }

  if (hidden.length > 0) {
    return { kind: BlockerKind.HiddenNeed, names: hidden };
  }

  if (!isOrdered({ index, move, needs })) {
    return { kind: BlockerKind.RoleOrder };
  }

  if (!isDeclaredInOrder({ index, move, moves: round })) {
    return { kind: BlockerKind.Landing };
  }

  return { kind: BlockerKind.Binding };
}

/** Whether a need is a declaration its file does not export as the need takes it, which no move of the round lands. */
function isHidden({ need, move, moves }: IsHiddenInput): boolean {
  /** Whether the other move lands the need's declaration where this one lands. */
  const isLandingNeed: (other: Move) => boolean = (other) =>
    other.to === move.to && originKey(other.unit) === need.origin;

  /** Whether the file does not export the declaration as the need takes it. */
  const isUnexported: (declared: TopLevelName) => boolean = (declared) => !isExportedAsNeeded({ need, declared });

  return !moves.some(isLandingNeed) && Option.exists(need.declared, isUnexported);
}
