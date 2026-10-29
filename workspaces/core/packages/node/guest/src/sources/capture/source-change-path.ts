import type { SourceId } from '@mechane/records';
import { Effect } from 'effect';
import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { SourceGuestFailed } from '../../errors.ts';

/** A validated relative path beneath one active source checkout. */
type SourceChangePathInput = { readonly sourceId: SourceId; readonly folder: string; readonly path: string };

/** Checks every parent before a capture reads the leaf, so a repository symlink cannot redirect the read. */
export const sourceChangePath = Effect.fn('sourceChangePath')(function* ({
  sourceId,
  folder,
  path,
}: SourceChangePathInput): Effect.fn.Return<string, SourceGuestFailed> {
  const parts = path.split('/');
  const current = { folder };

  for (const part of parts.slice(0, -1)) {
    current.folder = join(current.folder, part);

    const parent = yield* Effect.tryPromise({
      try: () => lstat(current.folder),
      catch: () => new SourceGuestFailed({ sourceId, reason: 'source change has an unavailable parent' }),
    });

    if (!parent.isDirectory() || parent.isSymbolicLink()) {
      return yield* new SourceGuestFailed({
        sourceId,
        reason: 'source change traverses a non-directory or symbolic link',
      });
    }
  }

  return join(folder, path);
});
