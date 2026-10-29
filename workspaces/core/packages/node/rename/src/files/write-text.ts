import { Effect } from 'effect';
import { writeFile } from 'node:fs/promises';
import { FileStep } from '../constants.ts';
import { FileFailed } from '../errors.ts';

/** A file of the factory, by its absolute path, and its new text. */
type WriteTextInput = { readonly path: string; readonly text: string };

/** Writes a file of the factory's new text. */
export const writeText = Effect.fn('writeText')(function* ({
  path,
  text,
}: WriteTextInput): Effect.fn.Return<void, FileFailed> {
  yield* Effect.tryPromise({
    try: () => writeFile(path, text),
    catch: (cause) => new FileFailed({ step: FileStep.Write, path, reason: String(cause) }),
  });
});
