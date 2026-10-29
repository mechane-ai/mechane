import { Effect } from 'effect';
import { readFile } from 'node:fs/promises';
import { FileStep } from '../constants.ts';
import { FileFailed } from '../errors.ts';
import type { PathInput } from '../types.ts';

/** Reads a file of the factory as UTF-8 text. */
export const readText = Effect.fn('readText')(function* ({ path }: PathInput): Effect.fn.Return<string, FileFailed> {
  return yield* Effect.tryPromise({
    try: () => readFile(path, 'utf8'),
    catch: (cause) => new FileFailed({ step: FileStep.Read, path, reason: String(cause) }),
  });
});
