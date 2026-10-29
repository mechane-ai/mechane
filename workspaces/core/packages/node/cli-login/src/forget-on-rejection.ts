import { SavedLoginRejected } from '@mechane/cli-kernel';
import type { RunFailure } from '@mechane/cli-kernel';
import type { OperationFailed } from '@mechane/client';
import { ErrorFamily } from '@mechane/protocol';
import { Effect } from 'effect';
import { forgetLogin } from './store/forget-login.ts';

type ForgetOnRejectionInput<A> = {
  readonly configurationRoot: string;
  /** A call that sends the saved login's key. */
  readonly run: Effect.Effect<A, RunFailure>;
};

/** A refusal of the saved login's key, and the folder whose `mechane` folder holds that login. */
type ForgetRejectedInput = { readonly configurationRoot: string; readonly failure: OperationFailed };

/**
 * Runs a call that sends the saved login's key. When the deployment refuses the key as unauthenticated, it removes the
 * saved login before failing, so a dead key does not linger; after any other failure the login stays.
 */
export const forgetOnRejection = Effect.fn('forgetOnRejection')(function* <A>({
  configurationRoot,
  run,
}: ForgetOnRejectionInput<A>): Effect.fn.Return<A, RunFailure> {
  return yield* run.pipe(
    Effect.catchTags({ OperationFailed: (failure) => forgetRejected({ configurationRoot, failure }) }),
  );
});

/** Removes the saved login after an unauthenticated refusal of its key, then fails; other refusals fail as they are. */
const forgetRejected = Effect.fn('forgetRejected')(function* ({
  configurationRoot,
  failure,
}: ForgetRejectedInput): Effect.fn.Return<never, RunFailure> {
  if (failure.family !== ErrorFamily.Unauthenticated) {
    return yield* failure;
  }

  const path = yield* forgetLogin({ configurationRoot });

  return yield* new SavedLoginRejected({ rejection: failure, path });
});
