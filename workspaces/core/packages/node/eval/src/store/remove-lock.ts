import { Effect } from 'effect';
import { rm } from 'node:fs/promises';
import { EvalFileStep } from '../constants.ts';
import { EvalFileFailed } from '../errors.ts';

type RemoveLockInput = { readonly path: string };

/** Removes the out folder's lock at `path`, if it is there. */
export const removeLock = Effect.fn('removeLock')(function* ({
  path,
}: RemoveLockInput): Effect.fn.Return<void, EvalFileFailed> {
  yield* Effect.tryPromise({
    try: () => rm(path, { force: true }),
    catch: (cause) => new EvalFileFailed({ step: EvalFileStep.Remove, path, reason: String(cause) }),
  });
});
