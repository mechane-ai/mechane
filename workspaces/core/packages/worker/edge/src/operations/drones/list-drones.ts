import { callMech } from '@mechane/bindings';
import { catalog, MechNotFound, RequestInvalid } from '@mechane/protocol';
import type { DronePage, ObjectUnavailable } from '@mechane/protocol';
import { DronesAnswer } from '@mechane/rpc';
import { Effect, Match, Schema } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** Lists a page of the drones the mech started, which its object reads in one transaction without calling pi. */
export const listDrones = Effect.fn('listDrones')(function* ({
  input,
  settings,
}: WorkInput<typeof catalog.listDrones>): Effect.fn.Return<
  DronePage,
  MechNotFound | RequestInvalid | ObjectUnavailable
> {
  const { workspaceId, mechId, after } = input;
  const query = Schema.encodeSync(catalog.listDrones.query)({ after });

  const answer = yield* callMech({
    settings,
    workspaceId,
    mechId,
    call: ({ mech }) => mech.drones({ query }),
    answer: DronesAnswer,
  });

  return yield* Match.valueTags(answer, {
    Listed: ({ drones, hasMore }) => Effect.succeed({ drones, hasMore }),
    MechMissing: () => new MechNotFound({ mechId }),
    CursorMissing: () => new RequestInvalid({ reason: 'after names no drone of this mech' }),
  });
});
