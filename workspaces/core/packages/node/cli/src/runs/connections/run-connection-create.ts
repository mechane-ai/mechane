import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { WorkspaceAccess } from '@mechane/eval';
import { WorkspaceId } from '@mechane/records';
import { Effect } from 'effect';
import { withSavedConnection } from './with-saved-connection.ts';

/** Creates an owner-approved remote URL and prints its reusable connection identifier. */
export const runConnectionCreate = Effect.fn('runConnectionCreate')(function* ({
  call,
  origin,
  input,
  credentials,
}: RunInput<'connection create'>): Effect.fn.Return<CommandResult<'connection create'>, RunFailure> {
  const use: (access: WorkspaceAccess) => Effect.Effect<CommandResult<'connection create'>['result'], RunFailure> = ({
    token,
    workspaceId,
  }) => {
    const workspace = WorkspaceId.make(workspaceId);

    return call({ name: 'createConnection', input: { ...input, workspaceId: workspace }, credential: token });
  };

  return yield* withSavedConnection({ call, origin, credentials, use });
});
