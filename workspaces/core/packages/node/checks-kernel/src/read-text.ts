import { Effect } from 'effect';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WORKSPACE_FOLDER } from './constants.ts';
import { InputUnreadable } from './errors.ts';
import type { ReadInput } from './types.ts';

/** Reads one file as text; a relative path is relative to the product workspace. */
export const readText = Effect.fn('readText')(function* ({
  path,
}: ReadInput): Effect.fn.Return<string, InputUnreadable> {
  const absolute = resolve(WORKSPACE_FOLDER, path);

  return yield* Effect.tryPromise({
    try: () => readFile(absolute, 'utf8'),
    catch: (cause) => new InputUnreadable({ path, reason: String(cause) }),
  });
});
