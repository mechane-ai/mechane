import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { WorkspaceAccess } from '@mechane/eval';
import { slackEventsPath, SlackInstallationResult } from '@mechane/protocol';
import { WorkspaceId } from '@mechane/records';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

/** Returns the stable event URL after the workspace accepts the installation's credential references. */
export const runSlackConnect = Effect.fn('runSlackConnect')(function* ({
  call,
  input,
  origin,
  credentials,
  selectedWorkspaceId,
}: RunInput<'slack connect'>): Effect.fn.Return<CommandResult<'slack connect'>, RunFailure> {
  const use: (access: WorkspaceAccess) => Effect.Effect<CommandResult<'slack connect'>['result'], RunFailure> = ({
    token,
    workspaceId,
  }) => {
    const workspace = WorkspaceId.make(workspaceId);

    return call({ name: 'configureSlackInstallation', input: { workspaceId: workspace, ...input }, credential: token });
  };

  const result = yield* withWorkspace({ call, origin, credentials, selectedWorkspaceId, use });
  const lines: Array<string> = [result._tag];

  if (SlackInstallationResult.guards.Configured(result)) {
    const { workspaceId, id: connectionId } = result.installation;
    const path = slackEventsPath({ workspaceId, connectionId });
    const webhook = new URL(path, origin);

    lines.push(webhook.href);
  }

  return { result, lines };
});
