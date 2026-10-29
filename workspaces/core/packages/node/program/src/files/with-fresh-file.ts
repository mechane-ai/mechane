import { Effect } from 'effect';
import type { Scope } from 'effect';
import { rm, writeFile } from 'node:fs/promises';
import { FileStep } from './constants.ts';
import { FileWriteFailed } from './errors.ts';
import { freshFilePath } from './fresh-file-path.ts';
import type { FileInput } from './types.ts';

/** The fresh file `place` puts at the path. */
type PlaceInput = { readonly fresh: string };

/** A file to write fresh, and how the fresh file is put at its path. */
type WithFreshFileInput<E> = FileInput & { readonly place: (input: PlaceInput) => Effect.Effect<void, E> };

/**
 * Writes `contents` with `mode` to a fresh file beside `path`, on its filesystem, and runs `place` to put it at `path`.
 * The scope's end removes the fresh file, so a reader of `path` sees the whole file or none.
 */
export const withFreshFile = Effect.fn('withFreshFile')(function* <E>({
  path,
  contents,
  mode,
  place,
}: WithFreshFileInput<E>): Effect.fn.Return<void, FileWriteFailed | E, Scope.Scope> {
  const fresh = freshFilePath({ path });

  const removal = Effect.tryPromise({
    try: () => rm(fresh, { force: true }),
    catch: (cause) => new FileWriteFailed({ step: FileStep.Remove, path: fresh, reason: String(cause) }),
  });

  // A release: `rm` with `force` refuses only a fresh file the program does not own.
  yield* Effect.acquireRelease(Effect.succeed(fresh), () => Effect.orDie(removal));
  yield* Effect.tryPromise({
    try: () => writeFile(fresh, contents, { mode, flag: 'wx' }),
    catch: (cause) => new FileWriteFailed({ step: FileStep.Write, path: fresh, reason: String(cause) }),
  });
  yield* place({ fresh });
});
