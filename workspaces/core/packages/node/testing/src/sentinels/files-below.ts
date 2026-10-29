import { Effect } from 'effect';
import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FileStep } from '../constants.ts';
import { FileStepFailed } from '../errors.ts';
import type { SearchedText } from '../types.ts';
import type { PathInput } from './types.ts';

type FilesBelowInput = { readonly folder: string };

/** Every file below `folder`, as text in which a token's ASCII matches wherever a database stores it. */
export const filesBelow = Effect.fn('filesBelow')(function* ({
  folder,
}: FilesBelowInput): Effect.fn.Return<ReadonlyArray<SearchedText>, FileStepFailed> {
  const entries = yield* Effect.tryPromise({
    try: () => readdir(folder, { recursive: true, withFileTypes: true }),
    catch: (cause) => new FileStepFailed({ step: FileStep.List, path: folder, reason: String(cause) }),
  });

  const isFile: (entry: Dirent) => boolean = (entry) => entry.isFile();

  const read: (entry: Dirent) => Effect.Effect<SearchedText, FileStepFailed> = (entry) =>
    searchedText({ path: join(entry.parentPath, entry.name) });

  return yield* Effect.forEach(entries.filter(isFile), read, { concurrency: 'unbounded' });
});

/** A file's bytes as Latin-1 text, so every byte stays one character, under the file's path. */
const searchedText = Effect.fn('searchedText')(function* ({
  path,
}: PathInput): Effect.fn.Return<SearchedText, FileStepFailed> {
  const text = yield* Effect.tryPromise({
    try: () => readFile(path, 'latin1'),
    catch: (cause) => new FileStepFailed({ step: FileStep.Read, path, reason: String(cause) }),
  });

  return { name: path, text };
});
