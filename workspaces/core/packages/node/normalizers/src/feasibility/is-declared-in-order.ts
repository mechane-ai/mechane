import { Option } from 'effect';
import { landingOffsets } from '../landings/landing-offsets.ts';
import type { FeasibleInput } from './types.ts';

/**
 * Whether a unit can land below every declaration and landing unit it names, and above every declaration that names it.
 * A constant or a class read before its declaration throws.
 */
export function isDeclaredInOrder({ index, move, moves }: FeasibleInput): boolean {
  const incoming = moves.filter((other) => other.to === move.to).map(({ unit }) => unit);
  const landings = landingOffsets({ facts: Option.fromNullishOr(index.files.get(move.to)), units: incoming });

  return landings.some(({ unit, isOrdered }) => unit === move.unit && isOrdered);
}
