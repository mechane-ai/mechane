import { writeLog } from '@mechane/logs';
import { LogEvent } from '@mechane/protocol';
import type { catalog, OperationFailure, WorkspaceMemberRemoval } from '@mechane/protocol';
import { WorkspaceMemberChange, WorkspaceMemberRemovalAnswer } from '@mechane/rpc';
import { Effect } from 'effect';
import type { WorkInput } from '../../routing/types.ts';
import { callMemberChange } from './call-member-change.ts';
import { memberChangeFailure } from './member-change-failure.ts';
import { workspaceActorLog } from './workspace-actor-log.ts';

/** The directory removes authority before the revocation is returned and audited. */
export const removeWorkspaceMember = Effect.fn('removeWorkspaceMember')(function* ({
  input,
  settings,
  caller,
}: WorkInput<typeof catalog.removeWorkspaceMember>): Effect.fn.Return<
  WorkspaceMemberRemoval,
  OperationFailure<typeof catalog.removeWorkspaceMember>
> {
  const { workspaceId, principalId } = input;
  const change = WorkspaceMemberChange.cases.Remove.make({});

  const result = yield* callMemberChange({
    settings,
    caller,
    workspaceId,
    principalId,
    change,
    answer: WorkspaceMemberRemovalAnswer,
  });

  if (!WorkspaceMemberRemovalAnswer.guards.Removed(result)) {
    return yield* memberChangeFailure({ refusal: result, workspaceId, principalId });
  }

  const actor = workspaceActorLog({ caller, workspaceId });

  writeLog({ line: { event: LogEvent.WorkspaceMemberRemoved, ...actor, memberPrincipalId: principalId } });

  return { principalId: result.principalId };
});
