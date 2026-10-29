import { movedPath } from '@mechane/checks-kernel';
import type { FileUnwritable, PathMove } from '@mechane/checks-kernel';
import { Effect } from 'effect';
import { posix } from 'node:path';
import { removeEmptyFolder } from './remove-empty-folder.ts';

/** The step's moves and every file git tracks before it. */
type RemoveEmptyFoldersInput = { readonly moves: ReadonlyArray<PathMove>; readonly files: ReadonlyArray<string> };

/** A folder relative to the workspace. */
type AncestorsInput = { readonly folder: string };

/** Removes each folder the step's moves leave empty, the deepest first, so a folder holding only those goes too. */
export const removeEmptyFolders = Effect.fn('removeEmptyFolders')(function* ({
  moves,
  files,
}: RemoveEmptyFoldersInput): Effect.fn.Return<void, FileUnwritable> {
  /** Whether the step moves the file. */
  const isMoved: (path: string) => boolean = (path) => movedPath({ moves, path }) !== path;
  const left = files.filter(isMoved).map((path) => posix.dirname(path));
  const folders = new Set(left.flatMap((folder) => ancestors({ folder })));
  const deepest = [...folders].toSorted((first, second) => second.length - first.length);

  yield* Effect.forEach(deepest, (folder) => removeEmptyFolder({ folder }), { concurrency: 1, discard: true });
});

/** A folder and each folder that holds it, below the workspace. */
function ancestors({ folder }: AncestorsInput): ReadonlyArray<string> {
  const segments = folder.split('/');

  /** The folder of the segments through the one at the index. */
  const ancestor: (segment: string, index: number) => string = (_segment, index) =>
    segments.slice(0, index + 1).join('/');

  return segments.map(ancestor);
}
