import { originKey, unitNeeds } from '@mechane/modules';
import type { Move } from '@mechane/modules';
import type { FeasibleInput } from './types.ts';

/**
 * Whether the move's unit would land cut off. A unit that carries it lands elsewhere, or a need of it moves to another
 * file and leaves the import it lands with naming nothing.
 */
export function isStranded({ index, move, moves }: FeasibleInput): boolean {
  /** Whether the other move lands where this one does. */
  const isAlongside: (other: Move) => boolean = (other) => other.to === move.to;
  /** Whether the other move lands somewhere else. */
  const isElsewhere: (other: Move) => boolean = (other) => other.to !== move.to;
  const landing: ReadonlySet<string> = new Set(moves.filter(isAlongside).map((other) => originKey(other.unit)));
  const leaving: ReadonlySet<string> = new Set(moves.filter(isElsewhere).map((other) => originKey(other.unit)));

  /** Whether a carrier of the unit lands somewhere else. */
  const isLeftBehind: (carrier: string) => boolean = (carrier) => !landing.has(carrier);

  return move.carriers.some(isLeftBehind) || unitNeeds({ index, move }).some((need) => leaving.has(need.origin));
}
