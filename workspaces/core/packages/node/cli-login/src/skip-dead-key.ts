import type { OperationFailed } from '@mechane/client';
import { ErrorFamily } from '@mechane/protocol';
import { Effect } from 'effect';

type SkipDeadKeyInput = { readonly failure: OperationFailed };

/** Passes over a key the deployment refuses as unauthenticated, which is dead already; any other refusal fails. */
export const skipDeadKey = Effect.fn('skipDeadKey')(function* ({
  failure,
}: SkipDeadKeyInput): Effect.fn.Return<void, OperationFailed> {
  if (failure.family !== ErrorFamily.Unauthenticated) {
    return yield* failure;
  }
});
