import { MechNotFound } from '@mechane/protocol';
import type { EventPage, Mech } from '@mechane/protocol';
import type { EventsAnswer } from '@mechane/rpc';
import { Effect, Match } from 'effect';

type EventPageInput = { readonly answer: EventsAnswer; readonly mechId: Mech['id'] };

/** Both directions of event pagination share the same missing-mech decision. */
export const eventPage = Effect.fn('eventPage')(function* ({
  answer,
  mechId,
}: EventPageInput): Effect.fn.Return<EventPage, MechNotFound> {
  return yield* Match.valueTags(answer, {
    Listed: ({ events, hasMore }) => Effect.succeed({ events, hasMore }),
    MechMissing: () => new MechNotFound({ mechId }),
  });
});
