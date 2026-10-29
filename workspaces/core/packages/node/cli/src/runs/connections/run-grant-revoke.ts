import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { WorkspaceAccess } from '@mechane/eval';
import { WorkspaceId } from '@mechane/records';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

/** Revokes the selected connection grant before subsequent remote dispatches. */
export const runGrantRevoke = Effect.fn('runGrantRevoke')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'grant revoke'>): Effect.fn.Return<CommandResult<'grant revoke'>, RunFailure> {
  const use: (access: WorkspaceAccess) => Effect.Effect<CommandResult<'grant revoke'>['result'], RunFailure> = ({
    token,
    workspaceId,
  }) => {
    const workspace = WorkspaceId.make(workspaceId);

    return call({ name: 'revokeTools', input: { ...input, workspaceId: workspace }, credential: token });
  };

  const result = yield* withWorkspace({ call, origin, credentials, selectedWorkspaceId, use });

  return { lines: [`${result.mechId} ${result.connectionId} revoked`], result };
});
