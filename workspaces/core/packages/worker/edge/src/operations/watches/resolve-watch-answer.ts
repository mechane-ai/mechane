import { MechNotFound, WatchLimitReached, WatchNotFound } from '@mechane/protocol';
import type { Watch } from '@mechane/protocol';
import type { MechId, WatchId } from '@mechane/records';
import type { WatchAnswer } from '@mechane/rpc';
import { Effect, Match } from 'effect';

type ResolveWatchAnswerInput = { readonly answer: WatchAnswer; readonly mechId: MechId; readonly watchId: WatchId };

/** Maps a durable watch decision to its public record or resource failure. */
export const resolveWatchAnswer = Effect.fn('resolveWatchAnswer')(function* ({
  answer,
  mechId,
  watchId,
}: ResolveWatchAnswerInput): Effect.fn.Return<Watch, MechNotFound | WatchNotFound | WatchLimitReached> {
  return yield* Match.valueTags(answer, {
    Saved: ({ watch }) => Effect.succeed(watch),
    MechMissing: () => new MechNotFound({ mechId }),
    WatchMissing: () => new WatchNotFound({ watchId }),
    LimitReached: () => new WatchLimitReached({ mechId }),
  });
});
