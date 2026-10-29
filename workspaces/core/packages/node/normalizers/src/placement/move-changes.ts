import type { FileChange } from '@mechane/checks-kernel';
import { originKey } from '@mechane/modules';
import type { Move, PlacementIndex } from '@mechane/modules';
import { Option } from 'effect';
import { fileRewrite } from './file-rewrite.ts';
import { rewrittenFile } from './rewritten-file.ts';
import type { PathRewrite } from './types.ts';
import { useRewrite } from './use-rewrite.ts';

/** One round's index, and the moves it makes. */
type MoveChangesInput = { readonly index: PlacementIndex; readonly moves: ReadonlyArray<Move> };

/** One round's index, and one move it makes. */
type MoveInput = { readonly index: PlacementIndex; readonly move: Move };

/**
 * What a round's moves change in each file. Each unit leaves its file with the imports only it used, and lands in its
 * destination with the imports it needs. Each statement that took it takes it from there or drops it.
 */
export function moveChanges({ index, moves }: MoveChangesInput): ReadonlyArray<FileChange> {
  const retargets = moves.flatMap((move) => moveUses({ index, move }));
  const paths = new Set([...moves.flatMap(({ unit, to }) => [unit.path, to]), ...retargets.map(({ path }) => path)]);

  /** The change the round makes to one file. */
  const changedFile: (path: string) => FileChange = (path) => {
    const facts = Option.fromNullishOr(index.files.get(path));

    return rewrittenFile({ path, facts, rewrite: fileRewrite({ index, moves, retargets, facts, path }) });
  };

  return [...paths].map(changedFile);
}

/** How each statement that takes a moved unit changes. */
function moveUses({ index, move }: MoveInput): ReadonlyArray<PathRewrite> {
  const uses = Option.getOrElse(Option.fromNullishOr(index.uses.get(originKey(move.unit))), () => []);

  return uses.map((use) => useRewrite({ entries: index.entries, move, use }));
}
