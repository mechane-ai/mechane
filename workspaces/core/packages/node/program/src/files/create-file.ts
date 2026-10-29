import { Effect } from 'effect';
import type { Scope } from 'effect';
import { link } from 'node:fs/promises';
import { FileStep } from './constants.ts';
import { FileWriteFailed } from './errors.ts';
import type { FileInput } from './types.ts';
import { withFreshFile } from './with-fresh-file.ts';

/** A fresh file to link at `path`. */
type LinkFreshInput = { readonly fresh: string; readonly path: string };

/**
 * Creates the file at `path` once: a fresh file beside it takes `contents` with `mode`, then a link puts it in place,
 * which fails when `path` exists. An interruption waits for the creation to finish.
 */
export const createFile = Effect.fn('createFile')(
  function* ({ path, contents, mode }: FileInput): Effect.fn.Return<void, FileWriteFailed, Scope.Scope> {
    yield* withFreshFile({ path, contents, mode, place: ({ fresh }) => linkFresh({ fresh, path }) });
  },
  Effect.scoped,
  Effect.uninterruptible,
);

/** Links the fresh file at `path`, which fails when a file is there already. */
const linkFresh = Effect.fn('linkFresh')(function* ({
  fresh,
  path,
}: LinkFreshInput): Effect.fn.Return<void, FileWriteFailed> {
  yield* Effect.tryPromise({
    try: () => link(fresh, path),
    catch: (cause) => new FileWriteFailed({ step: FileStep.Link, path, reason: String(cause) }),
  });
});
