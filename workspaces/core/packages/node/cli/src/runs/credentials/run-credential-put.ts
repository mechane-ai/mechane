import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { WorkspaceAccess } from '@mechane/eval';
import { WorkspaceId } from '@mechane/records';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';
import { readCredentialFile } from './read-credential-file.ts';

/** Sends file contents to the selected workspace while returning only credential metadata to command output. */
export const runCredentialPut = Effect.fn('runCredentialPut')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'credential put'>): Effect.fn.Return<CommandResult<'credential put'>, RunFailure> {
  const { secretReference, isCreateOnly, file } = input;
  const value = yield* readCredentialFile({ file });

  const use: (access: WorkspaceAccess) => Effect.Effect<CommandResult<'credential put'>['result'], RunFailure> = ({
    token,
    workspaceId,
  }) => {
    const workspace = WorkspaceId.make(workspaceId);

    return call({
      name: 'putCredential',
      input: { workspaceId: workspace, secretReference, value, isCreateOnly },
      credential: token,
    });
  };

  const result = yield* withWorkspace({ call, origin, credentials, selectedWorkspaceId, use });

  return { lines: [`${result.secretReference} saved (${result.keyVersion})`], result };
});
