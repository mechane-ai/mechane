import { writeLog } from '@mechane/logs';
import { LogEvent } from '@mechane/protocol';
import type { catalog, OperationFailure, WorkspaceMember } from '@mechane/protocol';
import { WorkspaceMemberChange, WorkspaceMemberSetAnswer } from '@mechane/rpc';
import { Effect } from 'effect';
import type { WorkInput } from '../../routing/types.ts';
import { callMemberChange } from './call-member-change.ts';
import { memberChangeFailure } from './member-change-failure.ts';
import { workspaceActorLog } from './workspace-actor-log.ts';

/** Only a committed directory grant is returned and audited. */
export const setWorkspaceMember = Effect.fn('setWorkspaceMember')(function* ({
  input,
  settings,
  caller,
}: WorkInput<typeof catalog.setWorkspaceMember>): Effect.fn.Return<
  WorkspaceMember,
  OperationFailure<typeof catalog.setWorkspaceMember>
> {
  const { workspaceId, principalId, role } = input;
  const change = WorkspaceMemberChange.cases.Set.make({ role });

  const result = yield* callMemberChange({
    settings,
    caller,
    workspaceId,
    principalId,
    change,
    answer: WorkspaceMemberSetAnswer,
  });

  if (!WorkspaceMemberSetAnswer.guards.Changed(result)) {
    return yield* memberChangeFailure({ refusal: result, workspaceId, principalId });
  }

  const actor = workspaceActorLog({ caller, workspaceId });

  writeLog({ line: { event: LogEvent.WorkspaceMemberSet, ...actor, memberPrincipalId: principalId, role } });

  return result.member;
});
