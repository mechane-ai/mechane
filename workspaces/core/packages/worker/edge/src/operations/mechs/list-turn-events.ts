import { callMech } from '@mechane/bindings';
import { catalog, MechNotFound, TurnNotFound } from '@mechane/protocol';
import type { EventPage, ObjectUnavailable } from '@mechane/protocol';
import { TurnEventsAnswer } from '@mechane/rpc';
import { Effect, Match, Schema } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** Reads the selected turn's history through the same membership boundary as its trace. */
export const listTurnEvents = Effect.fn('listTurnEvents')(function* ({
  input,
  settings,
}: WorkInput<typeof catalog.listTurnEvents>): Effect.fn.Return<
  EventPage,
  MechNotFound | TurnNotFound | ObjectUnavailable
> {
  const { workspaceId, mechId, turnId, after } = input;
  const query = Schema.encodeSync(catalog.listTurnEvents.query)({ after });

  const answer = yield* callMech({
    settings,
    workspaceId,
    mechId,
    call: ({ mech }) => mech.turnEvents({ turnId, query }),
    answer: TurnEventsAnswer,
  });

  return yield* Match.valueTags(answer, {
    Listed: ({ page }) => Effect.succeed(page),
    MechMissing: () => new MechNotFound({ mechId }),
    TurnMissing: () => new TurnNotFound({ turnId }),
  });
});
