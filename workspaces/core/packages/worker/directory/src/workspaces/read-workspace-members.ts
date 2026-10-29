import type { DirectoryStore } from '@mechane/directory-store';
import { WorkspaceMembersAnswer } from '@mechane/rpc';
import type { WorkspaceMembershipInput } from '@mechane/rpc';
import { Option, Schema } from 'effect';
import { workspaceOwnerRefusal } from './workspace-owner-refusal.ts';

type ReadWorkspaceMembersInput = WorkspaceMembershipInput & { readonly store: DirectoryStore };

/** An owner check and the listing share one directory transaction. */
export function readWorkspaceMembers({
  store,
  principalId,
  workspaceId,
}: ReadWorkspaceMembersInput): typeof WorkspaceMembersAnswer.Encoded {
  const read: () => typeof WorkspaceMembersAnswer.Encoded = () => {
    const refusal = workspaceOwnerRefusal({ store, principalId, workspaceId });

    if (Option.isSome(refusal)) {
      return refusal.value;
    }

    const members = store.workspaceMembers({ workspaceId });
    const answer = WorkspaceMembersAnswer.cases.Listed.make({ members });

    return Schema.encodeSync(WorkspaceMembersAnswer)(answer);
  };

  return store.atomic({ run: read });
}
