import type { DirectoryStore } from '@mechane/directory-store';
import { WorkspaceMemberChange, WorkspaceMemberChangeAnswer } from '@mechane/rpc';
import type { ChangeWorkspaceMemberInput } from '@mechane/rpc';
import { Option, Schema } from 'effect';
import type { DateTime } from 'effect';
import { memberChangeRefusal } from './member-change-refusal.ts';
import { requiredWorkspaceMember } from './required-workspace-member.ts';

type ChangeMemberInput = ChangeWorkspaceMemberInput & { readonly store: DirectoryStore; readonly now: DateTime.Utc };

/** Authorization and last-owner checks cannot interleave with membership mutation. */
export function changeWorkspaceMember({
  store,
  principalId,
  workspaceId,
  memberPrincipalId,
  change,
  now,
}: ChangeMemberInput): typeof WorkspaceMemberChangeAnswer.Encoded {
  const mutate: () => typeof WorkspaceMemberChangeAnswer.Encoded = () => {
    const refusal = memberChangeRefusal({ store, principalId, workspaceId, memberPrincipalId, change });

    if (Option.isSome(refusal)) {
      return refusal.value;
    }

    if (WorkspaceMemberChange.guards.Remove(change)) {
      store.removeWorkspaceMember({ workspaceId, principalId: memberPrincipalId });

      return WorkspaceMemberChangeAnswer.cases.Removed.make({ principalId: memberPrincipalId });
    }

    store.setWorkspaceMember({ workspaceId, principalId: memberPrincipalId, role: change.role, now });

    const member = requiredWorkspaceMember({ store, workspaceId, principalId: memberPrincipalId });
    const answer = WorkspaceMemberChangeAnswer.cases.Changed.make({ member });

    return Schema.encodeSync(WorkspaceMemberChangeAnswer)(answer);
  };

  return store.atomic({ run: mutate });
}
