import type { GeneratedFile } from '@mechane/rules';
import { Effect } from 'effect';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { GenerateStep, WORKSPACE_FOLDER } from '../constants.ts';
import { GenerateFailed } from '../errors.ts';

/** The generated files to write, and the stray files that carry the generated mark, to delete. */
type WriteFilesInput = { readonly files: ReadonlyArray<GeneratedFile>; readonly strays: ReadonlyArray<string> };

/**
 * Writes each generated file at its path in the workspace, after the folder that holds it, and deletes each stray file
 * the registry no longer generates. It writes one file at a time, in the registry's order.
 */
export const writeFiles = Effect.fn('writeFiles')(function* ({
  files,
  strays,
}: WriteFilesInput): Effect.fn.Return<void, GenerateFailed> {
  for (const { path, text } of files) {
    const absolute = join(WORKSPACE_FOLDER, path);
    const folder = dirname(absolute);

    yield* Effect.tryPromise({
      try: () => mkdir(folder, { recursive: true }),
      catch: (cause) => new GenerateFailed({ step: GenerateStep.Write, path, reason: String(cause) }),
    });
    yield* Effect.tryPromise({
      try: () => writeFile(absolute, text),
      catch: (cause) => new GenerateFailed({ step: GenerateStep.Write, path, reason: String(cause) }),
    });
  }

  for (const path of strays) {
    const absolute = join(WORKSPACE_FOLDER, path);

    yield* Effect.tryPromise({
      try: () => rm(absolute),
      catch: (cause) => new GenerateFailed({ step: GenerateStep.Write, path, reason: String(cause) }),
    });
  }
});
