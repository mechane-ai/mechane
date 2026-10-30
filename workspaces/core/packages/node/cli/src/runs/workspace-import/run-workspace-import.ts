import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { WorkspaceAccess } from '@mechane/eval';
import { WorkspaceId } from '@mechane/records';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';
import { applyWorkspaceImport } from './apply-workspace-import.ts';
import { readWorkspaceImport } from './read-workspace-import.ts';

/** Imports into the selected workspace and reports created or retained references without echoing credential values. */
export const runWorkspaceImport = Effect.fn('runWorkspaceImport')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'workspace import'>): Effect.fn.Return<CommandResult<'workspace import'>, RunFailure> {
  const document = yield* readWorkspaceImport({ file: input.file });

  const use: (access: WorkspaceAccess) => Effect.Effect<CommandResult<'workspace import'>['result'], RunFailure> = ({
    token,
    workspaceId: encodedWorkspaceId,
  }) => {
    const workspaceId = WorkspaceId.make(encodedWorkspaceId);

    return applyWorkspaceImport({ call, token, workspaceId, document, file: input.file });
  };

  const result = yield* withWorkspace({ call, origin, credentials, selectedWorkspaceId, use });

  const lines = [
    `imported ${result.importedCredentials.length} credentials; configured ${result.slackInstallations.length} Slack installations`,
    `retained ${result.retainedCredentials.length} existing credentials without comparing their values`,
  ];

  return { lines, result };
});
