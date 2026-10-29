import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { WorkspaceAccess } from '@mechane/eval';
import type { ToolGrant } from '@mechane/protocol';
import { WorkspaceId } from '@mechane/records';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

/** Prints the selected mech's current grants, including empty tool selections. */
export const runGrantList = Effect.fn('runGrantList')(function* ({
  call,
  origin,
  input,
  credentials,
}: RunInput<'grant list'>): Effect.fn.Return<CommandResult<'grant list'>, RunFailure> {
  const use: (access: WorkspaceAccess) => Effect.Effect<CommandResult<'grant list'>['result'], RunFailure> = ({
    token,
    workspaceId,
  }) => {
    const workspace = WorkspaceId.make(workspaceId);

    return call({ name: 'listToolGrants', input: { ...input, workspaceId: workspace }, credential: token });
  };

  const result = yield* withWorkspace({ call, origin, credentials, use });

  const line: (grant: ToolGrant) => string = (grant) => `${grant.connectionId}: ${grant.tools.join(', ')}`;

  return { lines: result.grants.map(line), result };
});
