import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { WorkspaceAccess } from '@mechane/eval';
import type { SlackInstallation } from '@mechane/protocol';
import { WorkspaceId } from '@mechane/records';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

/** Lists the selected workspace's installations without resolving the credentials used by Slack delivery. */
export const runSlackConnections = Effect.fn('runSlackConnections')(function* ({
  call,
  origin,
  credentials,
  selectedWorkspaceId,
}: RunInput<'slack connections'>): Effect.fn.Return<CommandResult<'slack connections'>, RunFailure> {
  const use: (access: WorkspaceAccess) => Effect.Effect<CommandResult<'slack connections'>['result'], RunFailure> = ({
    token,
    workspaceId,
  }) => {
    const workspace = WorkspaceId.make(workspaceId);

    return call({ name: 'listSlackInstallations', input: { workspaceId: workspace }, credential: token });
  };

  const result = yield* withWorkspace({ call, origin, credentials, selectedWorkspaceId, use });

  const line: (installation: SlackInstallation) => string = (installation) =>
    `${installation.id} ${installation.teamId} ${installation.botUserId}`;

  const lines = result.installations.map(line);

  return { result, lines };
});
