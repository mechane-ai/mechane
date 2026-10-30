import { WorkspaceImportConflict } from '@mechane/cli-kernel';
import type { RunFailure } from '@mechane/cli-kernel';
import { SlackInstallationResult } from '@mechane/protocol';
import type { SlackInstallation } from '@mechane/protocol';
import type { SlackConnectionId } from '@mechane/records';
import { Effect } from 'effect';
import type { ImportWorkspaceInput } from './types.ts';

type ImportWorkspaceSlackInput = Pick<ImportWorkspaceInput, 'call' | 'token' | 'workspaceId' | 'document'>;

type ImportSlackInstallationInput = Pick<ImportWorkspaceInput, 'call' | 'token' | 'workspaceId'> & {
  readonly installation: SlackInstallation;
};

/** Reuses identical installations and refuses conflicts so repeated imports preserve runtime changes. */
export const importWorkspaceSlack = Effect.fn('importWorkspaceSlack')(function* ({
  call,
  token,
  workspaceId,
  document,
}: ImportWorkspaceSlackInput): Effect.fn.Return<ReadonlyArray<SlackConnectionId>, RunFailure> {
  const install: (installation: SlackInstallation) => Effect.Effect<SlackConnectionId, RunFailure> = (installation) =>
    importSlackInstallation({ call, token, workspaceId, installation });

  return yield* Effect.forEach(document.slackInstallations, install, { concurrency: 1 });
});

const importSlackInstallation = Effect.fn('importSlackInstallation')(function* ({
  call,
  token,
  workspaceId,
  installation,
}: ImportSlackInstallationInput): Effect.fn.Return<SlackConnectionId, RunFailure> {
  const { id: connectionId, workspaceId: _workspaceId, ...configuration } = installation;
  const input = { workspaceId, connectionId, ...configuration, isCreateOnly: true };
  const result = yield* call({ name: 'configureSlackInstallation', input, credential: token });

  if (SlackInstallationResult.guards.Conflicting(result)) {
    return yield* new WorkspaceImportConflict({ workspaceId, connectionId });
  }

  return connectionId;
});
