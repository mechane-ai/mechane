import { WORKSPACE_FOLDER } from '@mechane/checks-kernel';
import { Effect } from 'effect';
import { rename } from 'node:fs/promises';
import { join } from 'node:path';
import type { FileFailed } from '../errors.ts';
import { MoveFailed } from '../errors.ts';
import type { FileMove } from '../types.ts';
import { rewriteImporter } from './rewrite-importer.ts';

/** A map's file moves, and the absolute path of every TypeScript file of the workspace. */
type MoveFilesInput = { readonly moves: ReadonlyArray<FileMove>; readonly files: ReadonlyArray<string> };

/** One file move, and the workspace's TypeScript files before it. */
type MoveFileInput = { readonly move: FileMove; readonly files: ReadonlyArray<string> };

/** Moves each file the map moves that is still in place, and points every relative import of it at its new path. */
export const moveFiles = Effect.fn('moveFiles')(function* ({
  moves,
  files,
}: MoveFilesInput): Effect.fn.Return<ReadonlyArray<string>, FileFailed | MoveFailed> {
  return yield* Effect.reduce(
    moves,
    () => files,
    (current, move) => moveFile({ move, files: current }),
  );
});

/** The workspace's TypeScript files once the file moved, which a file that moved already leaves as they are. */
const moveFile = Effect.fn('moveFile')(function* ({
  move,
  files,
}: MoveFileInput): Effect.fn.Return<ReadonlyArray<string>, FileFailed | MoveFailed> {
  const from = join(WORKSPACE_FOLDER, move.from);
  const to = join(WORKSPACE_FOLDER, move.to);

  if (!files.includes(from)) {
    return files;
  }

  yield* Effect.tryPromise({
    try: () => rename(from, to),
    catch: (cause) => new MoveFailed({ from: move.from, to: move.to, reason: String(cause) }),
  });

  const moved = [...files.filter((path) => path !== from), to];

  yield* Effect.forEach(moved, (importer) => rewriteImporter({ importer, from, to }), {
    discard: true,
    concurrency: 1,
  });

  return moved;
});
