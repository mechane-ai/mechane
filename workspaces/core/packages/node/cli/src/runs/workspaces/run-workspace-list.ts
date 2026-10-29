import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { withCredential } from '@mechane/cli-login';
import type { Workspace } from '@mechane/protocol';
import { Effect } from 'effect';

/** Lists the workspaces of the account the CLI's key signs in as, with its role and each daily allowance. */
export const runWorkspaceList = Effect.fn('runWorkspaceList')(function* ({
  call,
  origin,
  credentials,
}: RunInput<'workspace list'>): Effect.fn.Return<CommandResult<'workspace list'>, RunFailure> {
  const list = yield* withCredential({
    origin,
    credentials,
    use: ({ token }) => call({ name: 'listWorkspaces', input: {}, credential: token }),
  });

  const workspaceLine: (workspace: Workspace) => string = (workspace) =>
    `${workspace.id} ${workspace.name} (${workspace.role}) ${workspace.dailyAllowanceMicros} micro-dollars a day`;

  return { lines: list.workspaces.map(workspaceLine), result: list };
});
