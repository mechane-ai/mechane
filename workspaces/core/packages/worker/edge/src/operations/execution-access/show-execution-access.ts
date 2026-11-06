import { callWorkspace } from '@mechane/bindings';
import { MechNotFound } from '@mechane/protocol';
import type { catalog, ExecutionAccessState, OperationFailure } from '@mechane/protocol';
import { ExecutionAccessReading } from '@mechane/rpc';
import { Effect, Match } from 'effect';
import { requireWorkspaceOwner } from '../../admission/require-workspace-owner.ts';
import type { WorkInput } from '../../routing/types.ts';

/** Owners inspect references without exposing credentials or creating a machine. */
export const showExecutionAccess = Effect.fn('showExecutionAccess')(function* ({
  input,
  settings,
  caller,
}: WorkInput<typeof catalog.showExecutionAccess>): Effect.fn.Return<
  ExecutionAccessState,
  OperationFailure<typeof catalog.showExecutionAccess>
> {
  const { workspaceId, mechId } = input;

  yield* requireWorkspaceOwner({ settings, caller, workspaceId });

  const answer = yield* callWorkspace({
    settings,
    workspaceId,
    call: ({ workspace }) => workspace.executionAccess({ mechId }),
    answer: ExecutionAccessReading,
  });

  return yield* Match.valueTags(answer, {
    Found: ({ configuration }) => Effect.succeed(configuration),
    MechNotFound: () => new MechNotFound({ mechId }),
  });
});
