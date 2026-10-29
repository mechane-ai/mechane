import { Effect } from 'effect';
import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { FileStep } from '../constants.ts';
import { FileFailed } from '../errors.ts';

/** The folders git ignores or keeps for itself, which hold installed packages, build outputs and local runs. */
const SKIPPED_FOLDERS: ReadonlySet<string> = new Set(['.git', 'node_modules', 'dist', '.wrangler', '.celld', '.tenet']);

/** A folder, by its absolute path. */
type FactoryFilesInput = { readonly folder: string };

/** A folder, and one entry it lists. */
type EntryFilesInput = { readonly folder: string; readonly entry: Dirent };

/** The absolute path of every file below the folder, but in git's folder, installed packages and build outputs. */
export const factoryFiles = Effect.fn('factoryFiles')(function* ({
  folder,
}: FactoryFilesInput): Effect.fn.Return<ReadonlyArray<string>, FileFailed> {
  const entries = yield* Effect.tryPromise({
    try: () => readdir(folder, { withFileTypes: true }),
    catch: (cause) => new FileFailed({ step: FileStep.List, path: folder, reason: String(cause) }),
  });

  const groups = yield* Effect.forEach(entries, (entry) => entryFiles({ folder, entry }), { concurrency: 1 });

  return groups.flat();
});

/** The files of one entry of a folder: the entry when it is a file, each file below it when it is a folder walked. */
const entryFiles = Effect.fn('entryFiles')(function* ({
  folder,
  entry,
}: EntryFilesInput): Effect.fn.Return<ReadonlyArray<string>, FileFailed> {
  const path = join(folder, entry.name);

  if (entry.isDirectory() && !SKIPPED_FOLDERS.has(entry.name)) {
    return yield* factoryFiles({ folder: path });
  }

  if (entry.isFile()) {
    return [path];
  }

  return [];
});
