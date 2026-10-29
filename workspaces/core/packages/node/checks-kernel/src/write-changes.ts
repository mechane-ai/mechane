import { Effect, Option } from 'effect';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { WORKSPACE_FOLDER } from './constants.ts';
import { FileUnwritable } from './errors.ts';
import type { FileChange } from './types.ts';
import { writeTextFile } from './write-text-file.ts';

type WriteChangesInput = { readonly changes: ReadonlyArray<FileChange> };

type WriteChangeInput = { readonly change: FileChange };

/** Writes each changed file's text, creating its folder when new, and deletes each file a normalizer emptied. */
export const writeChanges = Effect.fn('writeChanges')(function* ({
  changes,
}: WriteChangesInput): Effect.fn.Return<void, FileUnwritable> {
  yield* Effect.forEach(changes, (change) => writeChange({ change }), { concurrency: 1, discard: true });
});

/** Writes one changed file's text, creating its folder when new, or deletes the file a normalizer emptied. */
const writeChange = Effect.fn('writeChange')(function* ({
  change,
}: WriteChangeInput): Effect.fn.Return<void, FileUnwritable> {
  const path = join(WORKSPACE_FOLDER, change.path);
  const { text } = change;

  if (Option.isNone(text)) {
    return yield* Effect.tryPromise({
      try: () => rm(path),
      catch: (cause) => new FileUnwritable({ path, reason: String(cause) }),
    });
  }

  return yield* writeTextFile({ path, text: text.value });
});
