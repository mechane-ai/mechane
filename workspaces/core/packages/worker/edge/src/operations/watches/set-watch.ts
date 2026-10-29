import { callMech } from '@mechane/bindings';
import { WatchConfiguration } from '@mechane/protocol';
import type {
  catalog,
  MechNotFound,
  ObjectUnavailable,
  Watch,
  WatchLimitReached,
  WatchNotFound,
} from '@mechane/protocol';
import { WatchAnswer } from '@mechane/rpc';
import { Effect, Schema } from 'effect';
import type { WorkInput } from '../../routing/types.ts';
import { resolveWatchAnswer } from './resolve-watch-answer.ts';

/** Passes the admitted configuration and caller identity to the owning mech. */
export const setWatch = Effect.fn('setWatch')(function* ({
  input,
  settings,
  caller,
}: WorkInput<typeof catalog.setWatch>): Effect.fn.Return<
  Watch,
  MechNotFound | ObjectUnavailable | WatchNotFound | WatchLimitReached
> {
  const { workspaceId, mechId, watchId } = input;
  const configuration = Schema.encodeSync(WatchConfiguration)(input);
  const creatorId = caller.principal.id;

  const answer = yield* callMech({
    settings,
    workspaceId,
    mechId,
    call: ({ mech }) => mech.setWatch({ watchId, configuration, creatorId }),
    answer: WatchAnswer,
  });

  return yield* resolveWatchAnswer({ answer, mechId, watchId });
});
