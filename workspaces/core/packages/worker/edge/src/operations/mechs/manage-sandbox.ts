import { callMech } from '@mechane/bindings';
import {
  DroneNotFound,
  MechBusy,
  MechNotFound,
  SandboxCapacityReached,
  SandboxDisabled,
  SandboxRequest,
} from '@mechane/protocol';
import type { catalog, ObjectUnavailable, SandboxReport } from '@mechane/protocol';
import { WorkspaceId } from '@mechane/records';
import { SandboxAnswer } from '@mechane/rpc';
import { Effect, Match, Schema } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** Membership is checked by the router; the mech checks that the target drone belongs to it. */
export const manageSandbox = Effect.fn('manageSandbox')(function* ({
  input,
  settings,
}: WorkInput<typeof catalog.manageSandbox>): Effect.fn.Return<
  SandboxReport,
  MechNotFound | DroneNotFound | MechBusy | ObjectUnavailable | SandboxDisabled | SandboxCapacityReached
> {
  const { workspaceId, mechId, ...request } = input;
  const ownerWorkspaceId = WorkspaceId.make(workspaceId);
  const encoded = Schema.encodeSync(SandboxRequest)(request);

  const answer = yield* callMech({
    settings,
    workspaceId,
    mechId,
    call: ({ mech }) => mech.manageSandbox({ request: encoded }),
    answer: SandboxAnswer,
  });

  return yield* Match.valueTags(answer, {
    Found: ({ report }) => Effect.succeed(report),
    MechMissing: () => new MechNotFound({ mechId }),
    DroneMissing: ({ droneId }) => new DroneNotFound({ droneId }),
    Busy: () => new MechBusy({ mechId }),
    Disabled: () => new SandboxDisabled({ workspaceId: ownerWorkspaceId }),
    CapacityReached: () => new SandboxCapacityReached({ workspaceId: ownerWorkspaceId }),
  });
});
