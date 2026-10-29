import { ToolGrant } from '@mechane/protocol';
import type { catalog, ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '@mechane/protocol';
import { Effect } from 'effect';
import { callOwnerWorkspace } from '../../admission/call-owner-workspace.ts';
import type { WorkInput } from '../../routing/types.ts';

/** Requires live owner membership before revoking remote tool authority. */
export const revokeTools = Effect.fn('revokeTools')(function* ({
  input,
  caller,
  settings,
}: WorkInput<typeof catalog.revokeTools>): Effect.fn.Return<
  typeof ToolGrant.Type,
  ObjectUnavailable | WorkspaceNotFound | WorkspaceOwnerRequired
> {
  const { workspaceId, mechId } = input;

  return yield* callOwnerWorkspace({
    caller,
    settings,
    workspaceId,
    call: ({ workspace }) => workspace.revokeTools({ mechId, connectionId: input.connectionId }),
    answer: ToolGrant,
  });
});
