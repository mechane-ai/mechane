import { SourceGuestAnswer } from '@mechane/sandbox-wire';
import type { SourceClone } from '@mechane/sandbox-wire';
import { Effect } from 'effect';
import type { SourceGuestFailed } from '../../errors.ts';
import type { GuestSettings } from '../../types.ts';
import { cloneSource } from './clone-source.ts';

type CompleteSourceCloneInput = { readonly settings: GuestSettings; readonly clone: SourceClone };

type SourceCloneFailures = {
  readonly SourceGuestFailed: (failure: SourceGuestFailed) => Effect.Effect<SourceGuestAnswer>;
};

/** A failed checkout becomes the journal's sanitized terminal answer without admitting another clone. */
export const completeSourceClone = Effect.fn('completeSourceClone')(function* ({
  settings,
  clone,
}: CompleteSourceCloneInput): Effect.fn.Return<SourceGuestAnswer> {
  const refused: SourceCloneFailures['SourceGuestFailed'] = (failure) => {
    const answer = SourceGuestAnswer.cases.Failed.make({ reason: failure.reason });

    return Effect.succeed(answer);
  };

  const failures: SourceCloneFailures = { SourceGuestFailed: refused };

  return yield* cloneSourceAnswer({ settings, clone }).pipe(Effect.catchTags(failures));
});

/** The ready answer is produced only after the exact commit has been checked out successfully. */
const cloneSourceAnswer = Effect.fn('cloneSourceAnswer')(function* ({
  settings,
  clone,
}: CompleteSourceCloneInput): Effect.fn.Return<SourceGuestAnswer, SourceGuestFailed> {
  yield* cloneSource({ settings, clone });

  return SourceGuestAnswer.cases.Ready.make({});
});
