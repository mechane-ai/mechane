import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { WorkspaceAccess } from '@mechane/eval';
import type { CredentialMetadata } from '@mechane/protocol';
import { WorkspaceId } from '@mechane/records';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

/** Lists references and key versions in the selected workspace without reading any credential values. */
export const runCredentialList = Effect.fn('runCredentialList')(function* ({
  call,
  origin,
  credentials,
  selectedWorkspaceId,
}: RunInput<'credential list'>): Effect.fn.Return<CommandResult<'credential list'>, RunFailure> {
  const use: (access: WorkspaceAccess) => Effect.Effect<CommandResult<'credential list'>['result'], RunFailure> = ({
    token,
    workspaceId,
  }) => {
    const workspace = WorkspaceId.make(workspaceId);

    return call({ name: 'listCredentials', input: { workspaceId: workspace }, credential: token });
  };

  const result = yield* withWorkspace({ call, origin, credentials, selectedWorkspaceId, use });

  const line: (credential: CredentialMetadata) => string = (credential) =>
    `${credential.secretReference} (${credential.keyVersion})`;

  return { lines: result.credentials.map(line), result };
});
