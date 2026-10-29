import { PERMISSION_BITS, PrivateMode } from '@mechane/program';
import { Effect } from 'effect';
import { readFile, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { FileStep } from '../constants.ts';
import { FileStepFailed } from '../errors.ts';
import type { PathInput } from './types.ts';

/** A file's text and whether only its owner may read and write it. */
type PrivateFile = { readonly text: string; readonly isPrivate: boolean };

/** A file's text, and whether only its owner may read and write it, in a folder only its owner may enter. */
export const readPrivateFile = Effect.fn('readPrivateFile')(function* ({
  path,
}: PathInput): Effect.fn.Return<PrivateFile, FileStepFailed> {
  const folder = dirname(path);

  const [text, file, folderStats] = yield* Effect.all(
    [
      Effect.tryPromise({
        try: () => readFile(path, 'utf8'),
        catch: (cause) => new FileStepFailed({ step: FileStep.Read, path, reason: String(cause) }),
      }),
      Effect.tryPromise({
        try: () => stat(path),
        catch: (cause) => new FileStepFailed({ step: FileStep.Read, path, reason: String(cause) }),
      }),
      Effect.tryPromise({
        try: () => stat(folder),
        catch: (cause) => new FileStepFailed({ step: FileStep.Read, path: folder, reason: String(cause) }),
      }),
    ],
    { concurrency: 'unbounded' },
  );

  const isPrivate =
    // oxlint-disable-next-line no-bitwise -- a mode's access bits are its low nine bits, which only a mask reads
    (file.mode & PERMISSION_BITS) === PrivateMode.File && (folderStats.mode & PERMISSION_BITS) === PrivateMode.Folder;

  return { text, isPrivate };
});
