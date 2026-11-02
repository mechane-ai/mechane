import { callMech } from '@mechane/bindings';
import type { catalog, EventPage, MechNotFound, ObjectUnavailable } from '@mechane/protocol';
import { EventsAnswer } from '@mechane/rpc';
import { Duration, Effect } from 'effect';
import type { WorkInput } from '../../routing/types.ts';
import { eventPage } from './event-page.ts';

/** Lists a page of the mech's events after the cursor, which the mech's object waits for while its log holds none. */
export const listEvents = Effect.fn('listEvents')(function* ({
  input,
  settings,
}: WorkInput<typeof catalog.listEvents>): Effect.fn.Return<EventPage, MechNotFound | ObjectUnavailable> {
  const { workspaceId, mechId, after, wait } = input;
  const waitMs = Duration.toMillis(wait);

  const answer = yield* callMech({
    settings,
    workspaceId,
    mechId,
    call: ({ mech }) => mech.events({ after, waitMs }),
    answer: EventsAnswer,
  });

  return yield* eventPage({ answer, mechId });
});
