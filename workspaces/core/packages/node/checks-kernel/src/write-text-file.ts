import { Effect } from 'effect';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { FileUnwritable } from './errors.ts';

/** A file by its absolute path, and the text it holds. */
type WriteTextFileInput = { readonly path: string; readonly text: string };

/** Writes `text` to the file at `path`, creating its folder first when it is new. */
export const writeTextFile = Effect.fn('writeTextFile')(function* ({
  path,
  text,
}: WriteTextFileInput): Effect.fn.Return<void, FileUnwritable> {
  const folder = dirname(path);

  yield* Effect.tryPromise({
    try: () => mkdir(folder, { recursive: true }),
    catch: (cause) => new FileUnwritable({ path, reason: String(cause) }),
  });
  yield* Effect.tryPromise({
    try: () => writeFile(path, text),
    catch: (cause) => new FileUnwritable({ path, reason: String(cause) }),
  });
});
