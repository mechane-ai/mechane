import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { ExecutionLedger } from './types.ts';

type AdmitMutationInput = { readonly ledger: ExecutionLedger };

/** Holds checkpoint admission until the caller's complete mutation scope releases. */
export const admitGuestMutation = Effect.fn('admitGuestMutation')(function* ({
  ledger,
}: AdmitMutationInput): Effect.fn.Return<boolean, never, Scope.Scope> {
  if (!ledger.admitProcess()) {
    return false;
  }

  yield* Effect.acquireRelease(Effect.void, () => Effect.sync(ledger.finishProcessStart));

  return true;
});
