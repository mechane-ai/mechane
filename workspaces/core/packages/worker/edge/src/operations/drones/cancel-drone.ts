import { callMech } from '@mechane/bindings';
import { DroneEnded, DroneNotFound, MechNotFound } from '@mechane/protocol';
import type { catalog, DroneCancel, ObjectUnavailable } from '@mechane/protocol';
import { DroneCancelAnswer } from '@mechane/rpc';
import { Effect, Match } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** Cancels a drone of the mech for the caller; the mech decides in one transaction, and only its alarm stops pi. */
export const cancelDrone = Effect.fn('cancelDrone')(function* ({
  input,
  settings,
  caller,
}: WorkInput<typeof catalog.cancelDrone>): Effect.fn.Return<
  DroneCancel,
  MechNotFound | DroneNotFound | DroneEnded | ObjectUnavailable
> {
  const { workspaceId, mechId, droneId } = input;

  const answer = yield* callMech({
    settings,
    workspaceId,
    mechId,
    call: ({ mech }) => mech.cancelDrone({ droneId, cancelerId: caller.principal.id }),
    answer: DroneCancelAnswer,
  });

  return yield* Match.valueTags(answer, {
    Canceled: ({ canceledAt, cancelerId }) => Effect.succeed({ droneId, canceledAt, cancelerId }),
    MechMissing: () => new MechNotFound({ mechId }),
    DroneMissing: () => new DroneNotFound({ droneId }),
    Ended: () => new DroneEnded({ droneId }),
  });
});
