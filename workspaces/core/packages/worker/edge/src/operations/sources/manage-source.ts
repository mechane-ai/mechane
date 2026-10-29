import { callMech } from '@mechane/bindings';
import { MechBusy, MechNotFound, RequestInvalid, SourceRequest } from '@mechane/protocol';
import type {
  catalog,
  ObjectUnavailable,
  SourceReport,
  WorkspaceNotFound,
  WorkspaceOwnerRequired,
} from '@mechane/protocol';
import { PrincipalId } from '@mechane/records';
import { SourceAnswer } from '@mechane/rpc';
import { Effect, Schema } from 'effect';
import { requireWorkspaceOwner } from '../../admission/require-workspace-owner.ts';
import type { WorkInput } from '../../routing/types.ts';

/** Only a live workspace owner can grant source access or request draft publication. */
export const manageSource = Effect.fn('manageSource')(function* ({
  input,
  settings,
  caller,
}: WorkInput<typeof catalog.manageSource>): Effect.fn.Return<
  SourceReport,
  MechBusy | MechNotFound | RequestInvalid | ObjectUnavailable | WorkspaceNotFound | WorkspaceOwnerRequired
> {
  const { workspaceId, mechId, ...request } = input;

  yield* requireWorkspaceOwner({ settings, caller, workspaceId });

  const principalId = PrincipalId.make(caller.principal.id);
  const encoded = Schema.encodeSync(SourceRequest)(request);

  const answer = yield* callMech({
    settings,
    workspaceId,
    mechId,
    call: ({ mech }) => mech.manageSource({ request: encoded, principalId }),
    answer: SourceAnswer,
  });

  if (SourceAnswer.guards.MechMissing(answer)) {
    return yield* new MechNotFound({ mechId });
  }

  if (SourceAnswer.guards.Busy(answer)) {
    return yield* new MechBusy({ mechId });
  }

  if (SourceAnswer.guards.Refused(answer)) {
    return yield* new RequestInvalid({ reason: answer.reason });
  }

  return answer.report;
});
