import { fileRole } from '@mechane/modules';
import type { Move, Need, PlacementIndex } from '@mechane/modules';
import { moveEdges } from '../graph/move-edges.ts';
import type { FileEdge } from '../types.ts';
import { mayImport } from './may-import.ts';

/** One round's index, a candidate move, and the names its unit needs where it lands. */
type IsOrderedInput = { readonly index: PlacementIndex; readonly move: Move; readonly needs: ReadonlyArray<Need> };

/** Whether each import a move adds keeps the role files' order (ST-34). */
export function isOrdered({ index, move, needs }: IsOrderedInput): boolean {
  /** Whether the importing file's role may import the file the edge leads to. */
  const isAllowed: (edge: FileEdge) => boolean = ({ from, to }) =>
    mayImport({ role: fileRole({ path: from }), file: to });

  return moveEdges({ move, needs, uses: index.uses }).every(isAllowed);
}
