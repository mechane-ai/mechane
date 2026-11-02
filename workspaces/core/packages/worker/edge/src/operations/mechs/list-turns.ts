import { callMech } from '@mechane/bindings';
import { catalog, MechNotFound, RequestInvalid } from '@mechane/protocol';
import type { ObjectUnavailable, TurnPage } from '@mechane/protocol';
import { TurnsAnswer } from '@mechane/rpc';
import { Effect, Match, Schema } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** Reads a bounded page of turns without scanning the event history. */
export const listTurns = Effect.fn('listTurns')(function* ({
  input,
  settings,
}: WorkInput<typeof catalog.listTurns>): Effect.fn.Return<TurnPage, MechNotFound | RequestInvalid | ObjectUnavailable> {
  const { workspaceId, mechId, after } = input;
  const query = Schema.encodeSync(catalog.listTurns.query)({ after });

  const answer = yield* callMech({
    settings,
    workspaceId,
    mechId,
    call: ({ mech }) => mech.turns({ query }),
    answer: TurnsAnswer,
  });

  return yield* Match.valueTags(answer, {
    Listed: ({ turns, hasMore }) => Effect.succeed({ turns, hasMore }),
    MechMissing: () => new MechNotFound({ mechId }),
    CursorMissing: () => new RequestInvalid({ reason: 'after names no turn of this mech' }),
  });
});
