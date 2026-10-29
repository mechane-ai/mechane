import { callMech } from '@mechane/bindings';
import { DroneNotFound, MechBusy, MechNotFound, SandboxRequest } from '@mechane/protocol';
import type { catalog, ObjectUnavailable, SandboxReport } from '@mechane/protocol';
import { SandboxAnswer } from '@mechane/rpc';
import { Effect, Match, Schema } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** Membership is checked by the router; the mech checks that the target drone belongs to it. */
export const manageSandbox = Effect.fn('manageSandbox')(function* ({
  input,
  settings,
}: WorkInput<typeof catalog.manageSandbox>): Effect.fn.Return<
  SandboxReport,
  MechNotFound | DroneNotFound | MechBusy | ObjectUnavailable
> {
  const { workspaceId, mechId, ...request } = input;
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
  });
});
