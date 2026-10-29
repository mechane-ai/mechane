import { unitNeeds } from '@mechane/modules';
import type { Move, PlacementIndex } from '@mechane/modules';
import { Option } from 'effect';
import type { FileEdge } from '../types.ts';
import { moveEdges } from './move-edges.ts';
import { reaches } from './reaches.ts';
import type { AcyclicState, FileGraph } from './types.ts';

/** One round's index, the moves accepted so far with their file graph, and the next candidate. */
type AcceptedAfterInput = { readonly index: PlacementIndex; readonly state: AcyclicState; readonly move: Move };

type WithEdgesInput = { readonly graph: FileGraph; readonly edges: ReadonlyArray<FileEdge> };

/** The accepted moves after the candidate: with it and its imports when they close no cycle, else as they were. */
export function acceptedAfter({ index, state, move }: AcceptedAfterInput): AcyclicState {
  const { graph, accepted } = state;
  const edges = moveEdges({ move, needs: unitNeeds({ index, move }), uses: index.uses });

  /** Whether an import the move adds closes a cycle: the file it imports already leads back. */
  const closesCycle: (edge: FileEdge) => boolean = ({ from, to }) => reaches({ graph, start: to, goal: from });

  if (edges.some(closesCycle)) {
    return state;
  }

  return { graph: withEdges({ graph, edges }), accepted: [...accepted, move] };
}

/** The file graph with each edge added to it. */
function withEdges({ graph, edges }: WithEdgesInput): FileGraph {
  /** A file's imports with the edges from it added. */
  const widened: (group: readonly [string, ReadonlyArray<FileEdge>]) => readonly [string, ReadonlySet<string>] = ([
    from,
    group,
  ]) => {
    const imports = Option.getOrElse(Option.fromNullishOr(graph.get(from)), () => []);

    return [from, new Set([...imports, ...group.map(({ to }) => to)])];
  };

  return new Map([...graph, ...[...Map.groupBy(edges, ({ from }) => from)].map(widened)]);
}
