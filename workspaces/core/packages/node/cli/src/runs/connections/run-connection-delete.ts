import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { WorkspaceAccess } from '@mechane/eval';
import { WorkspaceId } from '@mechane/records';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

/** Deletes the selected connection and all of its mech grants. */
export const runConnectionDelete = Effect.fn('runConnectionDelete')(function* ({
  call,
  origin,
  input,
  credentials,
}: RunInput<'connection delete'>): Effect.fn.Return<CommandResult<'connection delete'>, RunFailure> {
  const use: (access: WorkspaceAccess) => Effect.Effect<CommandResult<'connection delete'>['result'], RunFailure> = ({
    token,
    workspaceId,
  }) => {
    const workspace = WorkspaceId.make(workspaceId);

    return call({ name: 'deleteConnection', input: { ...input, workspaceId: workspace }, credential: token });
  };

  const result = yield* withWorkspace({ call, origin, credentials, use });

  return { lines: [`${result.connectionId} deleted`], result };
});
