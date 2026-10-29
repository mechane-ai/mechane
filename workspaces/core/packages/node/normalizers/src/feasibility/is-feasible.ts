import { originKey, unitNeeds } from '@mechane/modules';
import type { FileFacts, Move, Need, PlacementIndex } from '@mechane/modules';
import { Option } from 'effect';
import { bindingOf } from './binding-of.ts';
import { incomingClaims } from './incoming-claims.ts';
import { isDeclaredInOrder } from './is-declared-in-order.ts';
import { isExportedAsNeeded } from './is-exported-as-needed.ts';
import { isOrdered } from './is-ordered.ts';
import type { FeasibleInput } from './types.ts';

/** One round's index, a candidate move, every candidate move, the destination's facts, a need and every claim there. */
type IsMetInput = {
  readonly index: PlacementIndex;
  readonly move: Move;
  readonly moves: ReadonlyArray<Move>;
  /** Absent for a role file the round creates. */
  readonly to: Option.Option<FileFacts>;
  readonly need: Need;
  readonly claims: ReadonlyMap<string, ReadonlySet<string>>;
};

/** Whether a move's unit reaches every binding it needs where it lands, in order, with its own name free there. */
export function isFeasible({ index, move, moves }: FeasibleInput): boolean {
  const to = Option.fromNullishOr(index.files.get(move.to));
  const claims = incomingClaims({ index, incoming: moves.filter((other) => other.to === move.to) });
  const unitBinding = bindingOf({ index, to, name: move.unit.name });
  const isFree = Option.isNone(unitBinding) || unitBinding.value === originKey(move.unit);

  if (!isFree) {
    return false;
  }

  const needs = unitNeeds({ index, move });

  return (
    isOrdered({ index, move, needs }) &&
    isDeclaredInOrder({ index, move, moves }) &&
    needs.every((need) => isMet({ index, move, moves, to, need, claims }))
  );
}

/**
 * Whether the destination can bind a need. It can when a unit landing there declares it, or it binds the same
 * declaration already. Otherwise nothing there may bind the name, and no other unit landing there may claim it.
 */
function isMet({ index, move, moves, to, need, claims }: IsMetInput): boolean {
  /** Whether the other move lands the need's declaration where this one lands. */
  const isLandingNeed: (other: Move) => boolean = (other) =>
    other.to === move.to && originKey(other.unit) === need.origin;

  if (moves.some(isLandingNeed)) {
    return true;
  }

  const bound = bindingOf({ index, to, name: need.local });

  if (Option.exists(Option.fromNullishOr(claims.get(need.local)), ({ size }) => size > 1)) {
    return false;
  }

  if (Option.isSome(bound)) {
    return bound.value === need.origin;
  }

  if (Option.isNone(need.declared)) {
    return true;
  }

  /** Whether the unit's file already imports the destination. */
  const importsDestination: (facts: FileFacts) => boolean = ({ statements }) =>
    statements.some(({ target }) => Option.contains(target, move.to));

  const ownFile = Option.fromNullishOr(index.files.get(move.unit.path));

  return isExportedAsNeeded({ need, declared: need.declared.value }) && !Option.exists(ownFile, importsDestination);
}
