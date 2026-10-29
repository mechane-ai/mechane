import type { DirectoryStore } from '@mechane/directory-store';
import { MembershipRole } from '@mechane/protocol';
import { WorkspaceOwnerRefusal } from '@mechane/rpc';
import type { WorkspaceMembershipInput } from '@mechane/rpc';
import { Option } from 'effect';

type WorkspaceOwnerRefusalInput = WorkspaceMembershipInput & { readonly store: DirectoryStore };

/** Administration rechecks membership within the transaction that reads or changes it. */
export function workspaceOwnerRefusal({
  store,
  principalId,
  workspaceId,
}: WorkspaceOwnerRefusalInput): Option.Option<WorkspaceOwnerRefusal> {
  const role = store.workspaceMembership({ principalId, workspaceId });

  if (Option.isNone(role)) {
    const refusal = WorkspaceOwnerRefusal.cases.NotMember.make({});

    return Option.some(refusal);
  }

  if (role.value !== MembershipRole.Owner) {
    const refusal = WorkspaceOwnerRefusal.cases.OwnerRequired.make({});

    return Option.some(refusal);
  }

  return Option.none();
}
