import { originKey, StatementKind } from '@mechane/modules';
import type { Move, Need, PlacementIndex } from '@mechane/modules';
import { Option } from 'effect';
import type { FileEdge } from '../types.ts';

/** A candidate move, the names its unit needs where it lands, and every declaration's uses. */
type MoveEdgesInput = {
  readonly move: Move;
  readonly needs: ReadonlyArray<Need>;
  readonly uses: PlacementIndex['uses'];
};

/**
 * The imports a move adds to the file graph: from where it lands to each workspace file its unit needs. Each file that
 * takes the unit imports where it lands, its own file among them while it names it. A re-export takes a pushed unit
 * too, while a pull drops it.
 */
export function moveEdges({ move, needs, uses }: MoveEdgesInput): ReadonlyArray<FileEdge> {
  const takers = Option.getOrElse(Option.fromNullishOr(uses.get(originKey(move.unit))), () => [])
    .filter(({ statement }) => statement.kind === StatementKind.Import || !move.isPrivate)
    .map(({ path }) => path);

  return [
    ...needs.flatMap(({ form }) => Option.toArray(form.target)).map((target) => ({ from: move.to, to: target })),
    ...[...takers, ...[move.unit.path].filter(() => move.hasOwnUse)].map((taker) => ({ from: taker, to: move.to })),
  ].filter(({ from, to }) => from !== to);
}
