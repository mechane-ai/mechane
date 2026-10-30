import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { WorkspaceAccess } from '@mechane/eval';
import { WorkspaceId } from '@mechane/records';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

/** Removes an installation from the selected workspace without deleting its separately managed credentials. */
export const runSlackDisconnect = Effect.fn('runSlackDisconnect')(function* ({
  call,
  input,
  origin,
  credentials,
  selectedWorkspaceId,
}: RunInput<'slack disconnect'>): Effect.fn.Return<CommandResult<'slack disconnect'>, RunFailure> {
  const use: (access: WorkspaceAccess) => Effect.Effect<CommandResult<'slack disconnect'>['result'], RunFailure> = ({
    token,
    workspaceId,
  }) => {
    const workspace = WorkspaceId.make(workspaceId);

    return call({ name: 'deleteSlackInstallation', input: { workspaceId: workspace, ...input }, credential: token });
  };

  const result = yield* withWorkspace({ call, origin, credentials, selectedWorkspaceId, use });

  return { result, lines: [`${result.connectionId} disconnected`] };
});
