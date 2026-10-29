import type { DirectoryStore, WorkspaceMemberRow } from '@mechane/directory-store';
import { PrincipalId, WorkspaceId } from '@mechane/records';
import { Array, Option, Result, Schema } from 'effect';

/** A transaction must read the membership it just wrote. */
class DirectoryMemberMissing extends Schema.TaggedError<DirectoryMemberMissing>()('DirectoryMemberMissing', {
  workspaceId: WorkspaceId,
  principalId: PrincipalId,
}) {}

type RequiredMemberInput = {
  readonly store: DirectoryStore;
  readonly workspaceId: typeof WorkspaceId.Encoded;
  readonly principalId: PrincipalId;
};

/** An absent member after an owned grant is a broken directory invariant. */
export function requiredWorkspaceMember({ store, workspaceId, principalId }: RequiredMemberInput): WorkspaceMemberRow {
  const members = store.workspaceMembers({ workspaceId });
  const member = Array.findFirst(members, (entry) => entry.principalId === principalId);

  if (Option.isSome(member)) {
    return member.value;
  }

  const id = WorkspaceId.make(workspaceId);
  const error = new DirectoryMemberMissing({ workspaceId: id, principalId });
  const missing = Result.fail(error);

  return Result.getOrThrow(missing);
}
