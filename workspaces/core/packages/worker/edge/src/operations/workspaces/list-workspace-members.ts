import { callDirectory } from '@mechane/bindings';
import type {
  catalog,
  ObjectUnavailable,
  WorkspaceMemberList,
  WorkspaceNotFound,
  WorkspaceOwnerRequired,
} from '@mechane/protocol';
import { WorkspaceMembersAnswer } from '@mechane/rpc';
import { Effect } from 'effect';
import type { WorkInput } from '../../routing/types.ts';
import { memberOwnerFailure } from './member-owner-failure.ts';

/** Directory authority is checked again when the membership listing is read. */
export const listWorkspaceMembers = Effect.fn('listWorkspaceMembers')(function* ({
  input,
  settings,
  caller,
}: WorkInput<typeof catalog.listWorkspaceMembers>): Effect.fn.Return<
  WorkspaceMemberList,
  ObjectUnavailable | WorkspaceNotFound | WorkspaceOwnerRequired
> {
  const { workspaceId } = input;

  const result = yield* callDirectory({
    settings,
    call: ({ directory }) => directory.workspaceMembers({ principalId: caller.principal.id, workspaceId }),
    answer: WorkspaceMembersAnswer,
  });

  if (!WorkspaceMembersAnswer.guards.Listed(result)) {
    return yield* memberOwnerFailure({ refusal: result, workspaceId });
  }

  return { members: result.members };
});
