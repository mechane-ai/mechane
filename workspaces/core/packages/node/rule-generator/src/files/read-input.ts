import { Effect } from 'effect';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GenerateStep, WORKSPACE_FOLDER } from '../constants.ts';
import { GenerateFailed } from '../errors.ts';

/** A file the generator reads, by its path relative to the workspace. */
type ReadInputInput = { readonly path: string };

/** The text of one file the generator reads, by its path relative to the workspace. */
export const readInput = Effect.fn('readInput')(function* ({
  path,
}: ReadInputInput): Effect.fn.Return<string, GenerateFailed> {
  const absolute = join(WORKSPACE_FOLDER, path);

  return yield* Effect.tryPromise({
    try: () => readFile(absolute, 'utf8'),
    catch: (cause) => new GenerateFailed({ step: GenerateStep.Read, path, reason: String(cause) }),
  });
});
