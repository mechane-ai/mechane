import { Array, Option, Order } from 'effect';
import { TRAILING_SLASH } from './constants.ts';
import type { PathMove } from './packages.types.ts';

/** What ends a folder move's paths, and so tells it from the move of one file. */
const FOLDER_END = '/';

/** The longest `from` first, so a move of a folder inside a moved folder wins. */
const LONGEST_FIRST = Order.flip(Order.mapInput(Order.Number, ({ from }: PathMove) => from.length));

type MovedPathInput = { readonly moves: ReadonlyArray<PathMove>; readonly path: string };

/**
 * A file's or a folder's path after the step, relative to the workspace. A move of that one file takes it, or else the
 * move of the deepest folder that holds it, below whose `to` it lands; a path no move takes stays.
 */
export function movedPath({ moves, path }: MovedPathInput): string {
  const folder = `${path}${FOLDER_END}`;

  const takes: (move: PathMove) => boolean = ({ from }) =>
    from === path || (from.endsWith(FOLDER_END) && folder.startsWith(from));

  const taking = Array.head(Array.sort(moves.filter(takes), LONGEST_FIRST));

  if (Option.isNone(taking)) {
    return path;
  }

  const { from, to } = taking.value;

  return `${to}${folder.slice(from.length)}`.replace(TRAILING_SLASH, '');
}
