import { ConnectionLimitReached } from '@mechane/protocol';
import type {
  catalog,
  ObjectUnavailable,
  RemoteConnection,
  WorkspaceNotFound,
  WorkspaceOwnerRequired,
} from '@mechane/protocol';
import { ConnectionId } from '@mechane/records';
import { ConnectionMutation } from '@mechane/rpc';
import { Effect } from 'effect';
import type { WorkInput } from '../../routing/types.ts';
import { saveOwnedConnection } from './save-owned-connection.ts';

/** Requires live owner membership before adding workspace-scoped configuration. */
export const createConnection = Effect.fn('createConnection')(function* ({
  input,
  caller,
  settings,
}: WorkInput<typeof catalog.createConnection>): Effect.fn.Return<
  RemoteConnection,
  ObjectUnavailable | WorkspaceNotFound | WorkspaceOwnerRequired | ConnectionLimitReached
> {
  const connectionId = ConnectionId.make(crypto.randomUUID());

  const result = yield* saveOwnedConnection({ input, caller, settings, connectionId, isCreating: true });

  if (!ConnectionMutation.guards.Saved(result)) {
    return yield* new ConnectionLimitReached({});
  }

  return result.connection;
});
