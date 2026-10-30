import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { WorkspaceAccess } from '@mechane/eval';
import { WorkspaceId } from '@mechane/records';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

/** Removes the selected workspace's stored value while leaving integration references for the owner to update. */
export const runCredentialDelete = Effect.fn('runCredentialDelete')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'credential delete'>): Effect.fn.Return<CommandResult<'credential delete'>, RunFailure> {
  const use: (access: WorkspaceAccess) => Effect.Effect<CommandResult<'credential delete'>['result'], RunFailure> = ({
    token,
    workspaceId,
  }) => {
    const workspace = WorkspaceId.make(workspaceId);

    return call({ name: 'deleteCredential', input: { ...input, workspaceId: workspace }, credential: token });
  };

  const result = yield* withWorkspace({ call, origin, credentials, selectedWorkspaceId, use });

  return { lines: [`${result.secretReference} deleted`], result };
});
