import { Option } from 'effect';
import type { FileGraph } from './types.ts';

/** The files a walk of the graph has passed, and the files it reaches next. */
type GraphWalk = { readonly seen: ReadonlySet<string>; readonly frontier: ReadonlyArray<string> };

type ReachesInput = { readonly graph: FileGraph; readonly start: string; readonly goal: string };

type NextWalkInput = { readonly graph: FileGraph; readonly walk: GraphWalk };

/** Whether the file graph leads from `start` to `goal` along its imports. */
export function reaches({ graph, start, goal }: ReachesInput): boolean {
  let walk: GraphWalk = { seen: new Set(), frontier: [start] };

  while (walk.frontier.length > 0 && !walk.frontier.includes(goal)) {
    walk = nextWalk({ graph, walk });
  }

  return walk.frontier.includes(goal);
}

/** The walk one step on: the frontier joins the files passed, and the files it imports that none passed are next. */
function nextWalk({ graph, walk }: NextWalkInput): GraphWalk {
  const seen: ReadonlySet<string> = new Set([...walk.seen, ...walk.frontier]);

  /** The files a file imports. */
  const imports: (file: string) => ReadonlyArray<string> = (file) => [
    ...Option.getOrElse(Option.fromNullishOr(graph.get(file)), () => []),
  ];

  /** Whether no step of the walk passed the file. */
  const isUnseen: (file: string) => boolean = (file) => !seen.has(file);
  const reached = [...new Set(walk.frontier.flatMap(imports))];

  return { seen, frontier: reached.filter(isUnseen) };
}
