import { FileUnwritable, WORKSPACE_FOLDER } from '@mechane/checks-kernel';
import { Effect } from 'effect';
import { readdir, rmdir } from 'node:fs/promises';
import { join } from 'node:path';

/** A folder relative to the workspace. */
type RemoveEmptyFolderInput = { readonly folder: string };

/** Removes one folder when it holds nothing. */
export const removeEmptyFolder = Effect.fn('removeEmptyFolder')(function* ({
  folder,
}: RemoveEmptyFolderInput): Effect.fn.Return<void, FileUnwritable> {
  const path = join(WORKSPACE_FOLDER, folder);

  const entries = yield* Effect.tryPromise({
    try: () => readdir(path),
    catch: (cause) => new FileUnwritable({ path: folder, reason: String(cause) }),
  });

  if (entries.length === 0) {
    yield* Effect.tryPromise({
      try: () => rmdir(path),
      catch: (cause) => new FileUnwritable({ path: folder, reason: String(cause) }),
    });
  }
});
