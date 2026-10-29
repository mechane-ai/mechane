import { callMech } from '@mechane/bindings';
import type {
  catalog,
  MechNotFound,
  ObjectUnavailable,
  Watch,
  WatchLimitReached,
  WatchNotFound,
} from '@mechane/protocol';
import { WatchAnswer } from '@mechane/rpc';
import { Effect } from 'effect';
import type { WorkInput } from '../../routing/types.ts';
import { resolveWatchAnswer } from './resolve-watch-answer.ts';

/** Passes the requested scheduling state to the owning mech. */
export const updateWatchStatus = Effect.fn('updateWatchStatus')(function* ({
  input,
  settings,
}: WorkInput<typeof catalog.updateWatchStatus>): Effect.fn.Return<
  Watch,
  MechNotFound | ObjectUnavailable | WatchNotFound | WatchLimitReached
> {
  const { workspaceId, mechId, watchId, status } = input;

  const answer = yield* callMech({
    settings,
    workspaceId,
    mechId,
    call: ({ mech }) => mech.watchStatus({ watchId, status }),
    answer: WatchAnswer,
  });

  return yield* resolveWatchAnswer({ answer, mechId, watchId });
});
