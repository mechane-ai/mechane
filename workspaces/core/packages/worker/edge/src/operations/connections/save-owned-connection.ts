import { ConnectionConfiguration } from '@mechane/protocol';
import type { catalog, ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '@mechane/protocol';
import type { ConnectionId } from '@mechane/records';
import { ConnectionMutation } from '@mechane/rpc';
import { Effect, Schema } from 'effect';
import { callOwnerWorkspace } from '../../admission/call-owner-workspace.ts';
import type { WorkInput } from '../../routing/types.ts';

type SaveOwnedConnectionInput = Pick<WorkInput<typeof catalog.createConnection>, 'input' | 'caller' | 'settings'> & {
  readonly connectionId: ConnectionId;
  readonly isCreating: boolean;
};

/** Owner admission and configuration encoding are identical for creation and replacement. */
export const saveOwnedConnection = Effect.fn('saveOwnedConnection')(function* ({
  input,
  caller,
  settings,
  connectionId,
  isCreating,
}: SaveOwnedConnectionInput): Effect.fn.Return<
  ConnectionMutation,
  ObjectUnavailable | WorkspaceNotFound | WorkspaceOwnerRequired
> {
  const configuration = Schema.encodeSync(ConnectionConfiguration)(input);

  return yield* callOwnerWorkspace({
    settings,
    caller,
    workspaceId: input.workspaceId,
    call: ({ workspace }) => workspace.saveConnection({ connectionId, configuration, isCreating }),
    answer: ConnectionMutation,
  });
});
