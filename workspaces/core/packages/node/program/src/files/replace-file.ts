import { Effect, Option } from 'effect';
import type { Scope } from 'effect';
import { rename } from 'node:fs/promises';
import { FileStep } from './constants.ts';
import { FileWriteFailed } from './errors.ts';
import type { FileInput } from './types.ts';
import { withFreshFile } from './with-fresh-file.ts';

/** The fresh file `accept` checks before it replaces the file. */
type AcceptInput = { readonly path: string };

/** A check of the fresh file before it replaces the file. */
type Acceptance<E> = {
  /** Checks the fresh file before the rename, and fails to keep the file as it was; none accepts any. */
  readonly accept: Option.Option<(input: AcceptInput) => Effect.Effect<void, E>>;
};

type ReplaceFileInput<E> = FileInput & Acceptance<E>;

/** A fresh file to rename over `path`, once `accept` takes it. */
type RenameFreshInput<E> = { readonly fresh: string; readonly path: string; readonly accept: Acceptance<E>['accept'] };

/**
 * Replaces the file at `path` at once: a fresh file beside it takes `contents` with `mode`, `accept` may refuse that
 * file, then a rename puts it in place.
 */
export const replaceFile = Effect.fn('replaceFile')(function* <E = never>({
  path,
  contents,
  mode,
  accept,
}: ReplaceFileInput<E>): Effect.fn.Return<void, FileWriteFailed | E, Scope.Scope> {
  yield* withFreshFile({ path, contents, mode, place: ({ fresh }) => renameFresh({ fresh, path, accept }) });
}, Effect.scoped);

/** Checks the fresh file with `accept`, when one is given, then renames it over `path`. */
const renameFresh = Effect.fn('renameFresh')(function* <E>({
  fresh,
  path,
  accept,
}: RenameFreshInput<E>): Effect.fn.Return<void, FileWriteFailed | E> {
  if (Option.isSome(accept)) {
    yield* accept.value({ path: fresh });
  }

  yield* Effect.tryPromise({
    try: () => rename(fresh, path),
    catch: (cause) => new FileWriteFailed({ step: FileStep.Rename, path, reason: String(cause) }),
  });
});
