import type { WorkspaceMemberRow } from '@mechane/directory-store';
import { MembershipRole } from '@mechane/protocol';
import { WorkspaceMemberChange } from '@mechane/rpc';
import { Option } from 'effect';

type LosesLastOwnerInput = {
  readonly members: ReadonlyArray<WorkspaceMemberRow>;
  /** Absent when the target principal has no membership in this workspace. */
  readonly member: Option.Option<WorkspaceMemberRow>;
  readonly change: WorkspaceMemberChange;
};

/** Keeping the owner role is idempotent; removing the last owner is never allowed. */
export function losesLastOwner({ members, member, change }: LosesLastOwnerInput): boolean {
  if (WorkspaceMemberChange.guards.Set(change) && change.role === MembershipRole.Owner) {
    return false;
  }

  const owners = members.filter((entry) => entry.role === MembershipRole.Owner);
  const memberIsOwner = Option.exists(member, (entry) => entry.role === MembershipRole.Owner);

  return memberIsOwner && owners.length === 1;
}
