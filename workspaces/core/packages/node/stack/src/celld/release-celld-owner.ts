import { SUCCESS_STATUS } from '@mechane/program';
import { Effect } from 'effect';
import type { StackFailed } from '../errors.ts';
import type { ChildInput } from '../types.ts';
import { removeCelldOwner } from './remove-celld-owner.ts';
import { verifyCelldStopped } from './verify-celld-stopped.ts';

type ReleaseCelldOwnerInput = ChildInput & { readonly projectFolder: string };

/** A successful supervisor exit reaps its runtime; other exits need proof that the recorded groups stopped. */
export const releaseCelldOwner = Effect.fn('releaseCelldOwner')(function* ({
  projectFolder,
  child,
}: ReleaseCelldOwnerInput): Effect.fn.Return<void, StackFailed> {
  if (child.exitCode === SUCCESS_STATUS) {
    return yield* removeCelldOwner({ projectFolder });
  }

  yield* verifyCelldStopped({ projectFolder });
});
