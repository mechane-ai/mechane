import { callWorkspace } from '@mechane/bindings';
import type {
  catalog,
  ConnectionDeletion,
  ObjectUnavailable,
  WorkspaceNotFound,
  WorkspaceOwnerRequired,
} from '@mechane/protocol';
import { Effect, Schema } from 'effect';
import { requireWorkspaceOwner } from '../../admission/require-workspace-owner.ts';
import type { WorkInput } from '../../routing/types.ts';

/** Requires live owner membership before removing the connection and its grants. */
export const deleteConnection = Effect.fn('deleteConnection')(function* ({
  input,
  caller,
  settings,
}: WorkInput<typeof catalog.deleteConnection>): Effect.fn.Return<
  typeof ConnectionDeletion.Type,
  ObjectUnavailable | WorkspaceNotFound | WorkspaceOwnerRequired
> {
  const { workspaceId, connectionId } = input;

  yield* requireWorkspaceOwner({ settings, caller, workspaceId });
  yield* callWorkspace({
    settings,
    workspaceId,
    call: ({ workspace }) => workspace.deleteConnection({ connectionId }),
    answer: Schema.Undefined,
  });

  return { connectionId };
});
