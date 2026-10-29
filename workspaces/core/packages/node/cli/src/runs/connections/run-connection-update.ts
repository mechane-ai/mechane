import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { WorkspaceAccess } from '@mechane/eval';
import { WorkspaceId } from '@mechane/records';
import { Effect } from 'effect';
import { withSavedConnection } from './with-saved-connection.ts';

/** Replaces owner-approved configuration and prunes grants for removed tools. */
export const runConnectionUpdate = Effect.fn('runConnectionUpdate')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'connection update'>): Effect.fn.Return<CommandResult<'connection update'>, RunFailure> {
  const use: (access: WorkspaceAccess) => Effect.Effect<CommandResult<'connection update'>['result'], RunFailure> = ({
    token,
    workspaceId,
  }) => {
    const workspace = WorkspaceId.make(workspaceId);

    return call({ name: 'updateConnection', input: { ...input, workspaceId: workspace }, credential: token });
  };

  return yield* withSavedConnection({ call, origin, credentials, selectedWorkspaceId, use });
});
