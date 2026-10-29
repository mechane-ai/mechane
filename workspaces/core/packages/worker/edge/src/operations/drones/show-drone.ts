import { callMech, callWorkspace } from '@mechane/bindings';
import { DroneNotFound, MechNotFound } from '@mechane/protocol';
import type { catalog, DroneTrace, ObjectUnavailable } from '@mechane/protocol';
import { DroneAnswer, WorkDispatchesAnswer } from '@mechane/rpc';
import { Effect, Match } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/**
 * Joins a drone and its brief, which the mech keeps, with its dispatches, which the workspace's ledger keeps under the
 * drone's id as its work.
 */
export const showDrone = Effect.fn('showDrone')(function* ({
  input,
  settings,
}: WorkInput<typeof catalog.showDrone>): Effect.fn.Return<
  DroneTrace,
  MechNotFound | DroneNotFound | ObjectUnavailable
> {
  const { workspaceId, mechId, droneId } = input;

  const answer = yield* callMech({
    settings,
    workspaceId,
    mechId,
    call: ({ mech }) => mech.drone({ droneId }),
    answer: DroneAnswer,
  });

  const { drone, brief } = yield* Match.valueTags(answer, {
    Found: (found) => Effect.succeed(found),
    MechMissing: () => new MechNotFound({ mechId }),
    DroneMissing: () => new DroneNotFound({ droneId }),
  });

  const dispatches = yield* callWorkspace({
    settings,
    workspaceId,
    call: ({ workspace }) => workspace.workDispatches({ mechId, workId: droneId }),
    answer: WorkDispatchesAnswer,
  });

  return { drone, brief, dispatches };
});
