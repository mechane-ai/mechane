import { callDirectory } from '@mechane/bindings';
import type { WorkerSettings } from '@mechane/bindings';
import { MembershipRole, WorkspaceNotFound, WorkspaceOwnerRequired } from '@mechane/protocol';
import type { ObjectUnavailable } from '@mechane/protocol';
import { WorkspaceId } from '@mechane/records';
import { WorkspaceMembership } from '@mechane/rpc';
import { Effect } from 'effect';
import type { Caller } from '../types.ts';

type RequireWorkspaceOwnerInput = {
  readonly settings: WorkerSettings;
  readonly caller: Caller;
  readonly workspaceId: typeof WorkspaceId.Encoded;
};

/** Checks live Directory membership so cached authentication cannot preserve revoked owner authority. */
export const requireWorkspaceOwner = Effect.fn('requireWorkspaceOwner')(function* ({
  settings,
  caller,
  workspaceId,
}: RequireWorkspaceOwnerInput): Effect.fn.Return<void, ObjectUnavailable | WorkspaceNotFound | WorkspaceOwnerRequired> {
  const membership = yield* callDirectory({
    settings,
    call: ({ directory }) => directory.workspaceMembership({ principalId: caller.principal.id, workspaceId }),
    answer: WorkspaceMembership,
  });

  if (WorkspaceMembership.guards.NotMember(membership)) {
    return yield* new WorkspaceNotFound({ workspaceId });
  }

  if (membership.role !== MembershipRole.Owner) {
    const workspace = WorkspaceId.make(workspaceId);

    return yield* new WorkspaceOwnerRequired({ workspaceId: workspace });
  }
});
