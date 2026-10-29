import { ToolGrantList } from '@mechane/protocol';
import type { catalog, ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '@mechane/protocol';
import { Effect } from 'effect';
import { callOwnerWorkspace } from '../../admission/call-owner-workspace.ts';
import type { WorkInput } from '../../routing/types.ts';

/** Requires live owner membership before inspecting a mech's current grants. */
export const listToolGrants = Effect.fn('listToolGrants')(function* ({
  input,
  caller,
  settings,
}: WorkInput<typeof catalog.listToolGrants>): Effect.fn.Return<
  typeof ToolGrantList.Type,
  ObjectUnavailable | WorkspaceNotFound | WorkspaceOwnerRequired
> {
  const { workspaceId, mechId } = input;

  return yield* callOwnerWorkspace({
    caller,
    settings,
    workspaceId,
    call: ({ workspace }) => workspace.toolGrants({ mechId }),
    answer: ToolGrantList,
  });
});
