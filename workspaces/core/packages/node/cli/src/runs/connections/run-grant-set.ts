import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { WorkspaceAccess } from '@mechane/eval';
import { WorkspaceId } from '@mechane/records';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

/** Replaces a mech's tool selection with an owner-approved subset. */
export const runGrantSet = Effect.fn('runGrantSet')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'grant set'>): Effect.fn.Return<CommandResult<'grant set'>, RunFailure> {
  const use: (access: WorkspaceAccess) => Effect.Effect<CommandResult<'grant set'>['result'], RunFailure> = ({
    token,
    workspaceId,
  }) => {
    const workspace = WorkspaceId.make(workspaceId);

    return call({ name: 'grantTools', input: { ...input, workspaceId: workspace }, credential: token });
  };

  const result = yield* withWorkspace({ call, origin, credentials, selectedWorkspaceId, use });

  return { lines: [`${result.mechId} ${result.connectionId}: ${result.tools.join(', ')}`], result };
});
