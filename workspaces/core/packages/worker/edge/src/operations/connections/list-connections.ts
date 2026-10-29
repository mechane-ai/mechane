import { callWorkspace } from '@mechane/bindings';
import { ConnectionList } from '@mechane/protocol';
import type { catalog, ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '@mechane/protocol';
import { Effect } from 'effect';
import { requireWorkspaceOwner } from '../../admission/require-workspace-owner.ts';
import type { WorkInput } from '../../routing/types.ts';

/** Requires live owner membership before exposing remote URL configuration. */
export const listConnections = Effect.fn('listConnections')(function* ({
  input,
  caller,
  settings,
}: WorkInput<typeof catalog.listConnections>): Effect.fn.Return<
  typeof ConnectionList.Type,
  ObjectUnavailable | WorkspaceNotFound | WorkspaceOwnerRequired
> {
  const { workspaceId } = input;

  yield* requireWorkspaceOwner({ settings, caller, workspaceId });

  return yield* callWorkspace({
    settings,
    workspaceId,
    call: ({ workspace }) => workspace.connections(),
    answer: ConnectionList,
  });
});
