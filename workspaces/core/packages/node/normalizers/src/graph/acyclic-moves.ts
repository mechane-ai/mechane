import type { FileFacts, Move, PlacementIndex } from '@mechane/modules';
import { Option } from 'effect';
import { acceptedAfter } from './accepted-after.ts';
import type { AcyclicState, FileGraph } from './types.ts';

/** One round's index, and its candidate moves in order. */
type AcyclicMovesInput = { readonly index: PlacementIndex; readonly moves: ReadonlyArray<Move> };

/**
 * The moves, in order, whose imports close no cycle of the file graph with the moves before them. A cycle can leave a
 * module's values unset when another module's top level reads them (ST-07).
 */
export function acyclicMoves({ index, moves }: AcyclicMovesInput): ReadonlyArray<Move> {
  /** A file's path, and the workspace files its statements name. */
  const fileImports: (facts: FileFacts) => readonly [string, ReadonlySet<string>] = ({ source, statements }) => [
    source.path,
    new Set(statements.flatMap(({ target }) => Option.toArray(target))),
  ];

  const graph: FileGraph = new Map([...index.files.values()].map(fileImports));
  let state: AcyclicState = { graph, accepted: [] };

  for (const move of moves) {
    state = acceptedAfter({ index, state, move });
  }

  return state.accepted;
}
