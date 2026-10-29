import { ConnectionNotFound } from '@mechane/protocol';
import type {
  catalog,
  ObjectUnavailable,
  RemoteConnection,
  WorkspaceNotFound,
  WorkspaceOwnerRequired,
} from '@mechane/protocol';
import { ConnectionMutation } from '@mechane/rpc';
import { Effect } from 'effect';
import type { WorkInput } from '../../routing/types.ts';
import { saveOwnedConnection } from './save-owned-connection.ts';

/** Requires live owner membership before replacing configuration and pruning grants. */
export const updateConnection = Effect.fn('updateConnection')(function* ({
  input,
  caller,
  settings,
}: WorkInput<typeof catalog.updateConnection>): Effect.fn.Return<
  RemoteConnection,
  ObjectUnavailable | WorkspaceNotFound | WorkspaceOwnerRequired | ConnectionNotFound
> {
  const connectionId = input.connectionId;

  const result = yield* saveOwnedConnection({ input, caller, settings, connectionId, isCreating: false });

  if (!ConnectionMutation.guards.Saved(result)) {
    return yield* new ConnectionNotFound({ connectionId });
  }

  return result.connection;
});
