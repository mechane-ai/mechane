import { callWorkspace } from '@mechane/bindings';
import { writeLog } from '@mechane/logs';
import { LogEvent, RequestInvalid, WorkspacePolicy, WorkspacePolicyConflict } from '@mechane/protocol';
import type {
  catalog,
  InstallationAdministratorRequired,
  ObjectUnavailable,
  WorkspaceNotFound,
} from '@mechane/protocol';
import { WorkspaceId } from '@mechane/records';
import { WorkspacePolicyMutation } from '@mechane/rpc';
import { Effect, Match, Option, Schema } from 'effect';
import type { WorkInput } from '../../../routing/types.ts';
import { workspaceActorLog } from '../workspace-actor-log.ts';
import { requireManagedWorkspace } from './require-managed-workspace.ts';

/** Administrator policy writes remain available during suspension and record the responsible principal. */
export const setWorkspacePolicy = Effect.fn('setWorkspacePolicy')(function* ({
  settings,
  caller,
  input,
}: WorkInput<typeof catalog.setWorkspacePolicy>): Effect.fn.Return<
  WorkspacePolicy,
  InstallationAdministratorRequired | ObjectUnavailable | WorkspaceNotFound | RequestInvalid | WorkspacePolicyConflict
> {
  const { workspaceId } = input;

  yield* requireManagedWorkspace({ settings, caller, workspaceId });

  const policy = Schema.encodeSync(WorkspacePolicy)(input.policy);
  const requestedCreateOnly = Option.fromUndefinedOr(input.isCreateOnly);
  const isCreateOnly = Option.getOrElse(requestedCreateOnly, () => false);
  const id = WorkspaceId.make(workspaceId);

  const result = yield* callWorkspace({
    settings,
    workspaceId,
    call: ({ workspace }) => workspace.savePolicy({ policy, isCreateOnly }),
    answer: WorkspacePolicyMutation,
  });

  const saved = yield* Match.valueTags(result, {
    Saved: ({ policy: accepted }) => Effect.succeed(accepted),
    AlreadyExists: () => new WorkspacePolicyConflict({ workspaceId: id }),
    LimitsExceeded: () => new RequestInvalid({ reason: 'workspace policy exceeds installation limits' }),
  });

  const actor = workspaceActorLog({ caller, workspaceId });

  writeLog({ line: { event: LogEvent.WorkspacePolicyChanged, ...actor } });

  return saved;
});
