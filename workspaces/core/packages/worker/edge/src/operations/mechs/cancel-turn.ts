import { callMech } from '@mechane/bindings';
import { MechNotFound, TurnEnded, TurnNotFound } from '@mechane/protocol';
import type { catalog, ObjectUnavailable, TurnCancel } from '@mechane/protocol';
import { TurnCancelAnswer } from '@mechane/rpc';
import { Effect, Match } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** Cancels a turn of the mech for the caller; the mech decides in one transaction, and only its alarm stops pi. */
export const cancelTurn = Effect.fn('cancelTurn')(function* ({
  input,
  settings,
  caller,
}: WorkInput<typeof catalog.cancelTurn>): Effect.fn.Return<
  TurnCancel,
  MechNotFound | TurnNotFound | TurnEnded | ObjectUnavailable
> {
  const { workspaceId, mechId, turnId } = input;

  const answer = yield* callMech({
    settings,
    workspaceId,
    mechId,
    call: ({ mech }) => mech.cancelTurn({ turnId, cancelerId: caller.principal.id }),
    answer: TurnCancelAnswer,
  });

  return yield* Match.valueTags(answer, {
    Canceled: ({ canceledAt, cancelerId }) => Effect.succeed({ turnId, canceledAt, cancelerId }),
    MechMissing: () => new MechNotFound({ mechId }),
    TurnMissing: () => new TurnNotFound({ turnId }),
    Ended: () => new TurnEnded({ turnId }),
  });
});
