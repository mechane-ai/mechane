import { callMech } from '@mechane/bindings';
import { catalog } from '@mechane/protocol';
import type { EventPage, MechNotFound, ObjectUnavailable } from '@mechane/protocol';
import { EventsAnswer } from '@mechane/rpc';
import { Effect, Schema } from 'effect';
import type { WorkInput } from '../../routing/types.ts';
import { eventPage } from './event-page.ts';

/** Reads the newest event page, or the page immediately before a cursor. */
export const listRecentEvents = Effect.fn('listRecentEvents')(function* ({
  input,
  settings,
}: WorkInput<typeof catalog.listRecentEvents>): Effect.fn.Return<EventPage, MechNotFound | ObjectUnavailable> {
  const { workspaceId, mechId } = input;
  const query = Schema.encodeSync(catalog.listRecentEvents.query)({ before: input.before });

  const answer = yield* callMech({
    settings,
    workspaceId,
    mechId,
    call: ({ mech }) => mech.recentEvents({ query }),
    answer: EventsAnswer,
  });

  return yield* eventPage({ answer, mechId });
});
