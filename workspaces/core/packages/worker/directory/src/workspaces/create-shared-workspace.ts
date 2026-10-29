import { WorkspaceKind } from '@mechane/directory-store';
import type { DirectoryStore, ManagedWorkspaceRow } from '@mechane/directory-store';
import { MembershipRole } from '@mechane/protocol';
import { SharedWorkspaceCreation } from '@mechane/rpc';
import type { CreateSharedWorkspaceInput } from '@mechane/rpc';
import { Option, Schema } from 'effect';
import type { DateTime } from 'effect';
import { requiredWorkspace } from './required-workspace.ts';

type CreateWorkspaceInput = CreateSharedWorkspaceInput & { readonly store: DirectoryStore; readonly now: DateTime.Utc };
type CreationAnswerInput = { readonly workspace: ManagedWorkspaceRow; readonly role: MembershipRole };

/** The initial membership and the shared workspace are committed together; retries cannot mint another allowance. */
export function createSharedWorkspace({
  store,
  principalId,
  id,
  name,
  dailyAllowanceMicros,
  now,
}: CreateWorkspaceInput): typeof SharedWorkspaceCreation.Encoded {
  const create: () => typeof SharedWorkspaceCreation.Encoded = () => {
    const existing = store.managedWorkspace({ workspaceId: id });

    if (Option.isSome(existing)) {
      const workspace = existing.value;
      const role = store.workspaceMembership({ principalId, workspaceId: id });
      const isCreator = Option.contains(workspace.creatorId, principalId);

      if (workspace.kind !== WorkspaceKind.Shared || workspace.name !== name) {
        return SharedWorkspaceCreation.cases.Conflict.make({});
      }

      if (!isCreator || Option.isNone(role)) {
        return SharedWorkspaceCreation.cases.Conflict.make({});
      }

      return creationAnswer({ workspace, role: role.value });
    }

    store.insertSharedWorkspace({ id, name, principalId, dailyAllowanceMicros, now });
    store.setWorkspaceMember({ principalId, workspaceId: id, role: MembershipRole.Owner, now });

    const workspace = requiredWorkspace({ store, workspaceId: id });

    return creationAnswer({ workspace, role: MembershipRole.Owner });
  };

  return store.atomic({ run: create });
}

function creationAnswer({ workspace, role }: CreationAnswerInput): typeof SharedWorkspaceCreation.Encoded {
  const { id, name, dailyAllowanceMicros, createdAt } = workspace;

  const answer = SharedWorkspaceCreation.cases.Created.make({
    workspace: { id, name, role, dailyAllowanceMicros, createdAt },
  });

  return Schema.encodeSync(SharedWorkspaceCreation)(answer);
}
