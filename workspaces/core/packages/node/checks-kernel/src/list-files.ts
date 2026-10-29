import { Effect } from 'effect';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { WORKSPACE_FOLDER } from './constants.ts';
import { InputUnreadable } from './errors.ts';

/** A path below a dependency or build folder, which no listing names. */
const SKIPPED_FOLDER = /(^|\/)(node_modules|dist)\//;

type ListFilesInput = { readonly folder: string; readonly extension: string };

/** Every file with `extension` below `folder` of the workspace, outside dependency and build folders. */
export const listFiles = Effect.fn('listFiles')(function* ({
  folder,
  extension,
}: ListFilesInput): Effect.fn.Return<ReadonlyArray<string>, InputUnreadable> {
  const absolute = resolve(WORKSPACE_FOLDER, folder);

  const entries = yield* Effect.tryPromise({
    try: () => readdir(absolute, { recursive: true }),
    catch: (cause) => new InputUnreadable({ path: folder, reason: String(cause) }),
  });

  const isListed: (entry: string) => boolean = (entry) => entry.endsWith(extension) && !SKIPPED_FOLDER.test(entry);

  return entries
    .filter(isListed)
    .map((entry) => join(folder, entry))
    .toSorted();
});
