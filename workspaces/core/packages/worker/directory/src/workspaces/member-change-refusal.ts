import { WorkspaceKind } from '@mechane/directory-store';
import type { DirectoryStore } from '@mechane/directory-store';
import { WorkspaceMemberChange, WorkspaceMemberChangeRefusal } from '@mechane/rpc';
import type { ChangeWorkspaceMemberInput } from '@mechane/rpc';
import { Array, Option } from 'effect';
import { losesLastOwner } from './loses-last-owner.ts';
import { requiredWorkspace } from './required-workspace.ts';
import { workspaceOwnerRefusal } from './workspace-owner-refusal.ts';

type MemberChangeRefusalInput = ChangeWorkspaceMemberInput & { readonly store: DirectoryStore };

/** The last owner cannot remove or demote themselves, and personal ownership never changes. */
export function memberChangeRefusal({
  store,
  principalId,
  workspaceId,
  memberPrincipalId,
  change,
}: MemberChangeRefusalInput): Option.Option<WorkspaceMemberChangeRefusal> {
  const refusal = workspaceOwnerRefusal({ store, principalId, workspaceId });

  if (Option.isSome(refusal)) {
    return refusal;
  }

  const workspace = requiredWorkspace({ store, workspaceId });

  if (workspace.kind === WorkspaceKind.Personal) {
    const result = WorkspaceMemberChangeRefusal.cases.PersonalWorkspace.make({});

    return Option.some(result);
  }

  return memberStateRefusal({ store, principalId, workspaceId, memberPrincipalId, change });
}

function memberStateRefusal({
  store,
  workspaceId,
  memberPrincipalId,
  change,
}: MemberChangeRefusalInput): Option.Option<WorkspaceMemberChangeRefusal> {
  const members = store.workspaceMembers({ workspaceId });
  const member = Array.findFirst(members, (entry) => entry.principalId === memberPrincipalId);

  if (WorkspaceMemberChange.guards.Remove(change) && Option.isNone(member)) {
    const result = WorkspaceMemberChangeRefusal.cases.MemberMissing.make({});

    return Option.some(result);
  }

  const principal = store.findPrincipal({ principalId: memberPrincipalId });

  if (Option.isNone(principal)) {
    const result = WorkspaceMemberChangeRefusal.cases.PrincipalMissing.make({});

    return Option.some(result);
  }

  if (losesLastOwner({ members, member, change })) {
    const result = WorkspaceMemberChangeRefusal.cases.LastOwner.make({});

    return Option.some(result);
  }

  return Option.none();
}
