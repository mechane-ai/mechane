import { callWorkspace } from '@mechane/bindings';
import { writeLog } from '@mechane/logs';
import { ExecutionAccessChange, LogEvent, MechNotFound } from '@mechane/protocol';
import type { catalog, ExecutionAccessState, OperationFailure } from '@mechane/protocol';
import { ExecutionAccessReading } from '@mechane/rpc';
import { Effect, Option, Schema } from 'effect';
import { requireWorkspaceOwner } from '../../admission/require-workspace-owner.ts';
import type { WorkInput } from '../../routing/types.ts';
import { workspaceActorLog } from '../workspaces/workspace-actor-log.ts';

/** Only live workspace ownership can replace the capabilities available to subsequent shell commands. */
export const configureExecutionAccess = Effect.fn('configureExecutionAccess')(function* ({
  input,
  settings,
  caller,
}: WorkInput<typeof catalog.configureExecutionAccess>): Effect.fn.Return<
  ExecutionAccessState,
  OperationFailure<typeof catalog.configureExecutionAccess>
> {
  const { workspaceId, mechId, access } = input;

  yield* requireWorkspaceOwner({ settings, caller, workspaceId });

  const configuration = Schema.encodeSync(ExecutionAccessChange)({ access });

  const answer = yield* callWorkspace({
    settings,
    workspaceId,
    call: ({ workspace }) => workspace.configureExecutionAccess({ mechId, configuration }),
    answer: ExecutionAccessReading,
  });

  if (ExecutionAccessReading.guards.MechNotFound(answer)) {
    return yield* new MechNotFound({ mechId });
  }

  const actor = workspaceActorLog({ caller, workspaceId });
  const isGranted = Option.isSome(access);

  writeLog({ line: { event: LogEvent.ExecutionAccessChanged, ...actor, mechId, isGranted } });

  return answer.configuration;
});
