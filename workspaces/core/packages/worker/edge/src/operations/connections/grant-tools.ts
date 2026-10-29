import { callWorkspace } from '@mechane/bindings';
import { ConnectionNotFound, MechNotFound, ToolGrantInvalid } from '@mechane/protocol';
import type {
  catalog,
  ObjectUnavailable,
  ToolGrant,
  WorkspaceNotFound,
  WorkspaceOwnerRequired,
} from '@mechane/protocol';
import { ToolGrantMutation } from '@mechane/rpc';
import { Effect } from 'effect';
import { requireWorkspaceOwner } from '../../admission/require-workspace-owner.ts';
import type { WorkInput } from '../../routing/types.ts';

/** Requires live owner membership before replacing a mech's selected tool names. */
export const grantTools = Effect.fn('grantTools')(function* ({
  input,
  caller,
  settings,
}: WorkInput<typeof catalog.grantTools>): Effect.fn.Return<
  ToolGrant,
  ObjectUnavailable | WorkspaceNotFound | WorkspaceOwnerRequired | ConnectionNotFound | MechNotFound | ToolGrantInvalid
> {
  const { workspaceId, mechId, connectionId, tools } = input;

  yield* requireWorkspaceOwner({ settings, caller, workspaceId });

  const answer = yield* callWorkspace({
    settings,
    workspaceId,
    call: ({ workspace }) => workspace.grantTools({ mechId, connectionId, tools }),
    answer: ToolGrantMutation,
  });

  if (ToolGrantMutation.guards.ConnectionNotFound(answer)) {
    return yield* new ConnectionNotFound({ connectionId });
  }

  if (ToolGrantMutation.guards.MechNotFound(answer)) {
    return yield* new MechNotFound({ mechId });
  }

  if (ToolGrantMutation.guards.InvalidTools(answer)) {
    return yield* new ToolGrantInvalid({ connectionId });
  }

  return answer.grant;
});
