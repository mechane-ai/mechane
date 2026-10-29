import { MembershipRole } from '@mechane/protocol';
import { PrincipalId, RecordName, renamedWireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { DirectoryWorkspace } from './directory.schemas.ts';

/** A creation retry returns the existing workspace only while its creator remains a member. */
export const SharedWorkspaceCreation = Schema.TaggedUnion({ Created: { workspace: DirectoryWorkspace }, Conflict: {} });

export type SharedWorkspaceCreation = typeof SharedWorkspaceCreation.Type;

/** RPC encodes membership timestamps as epoch milliseconds. */
const DirectoryWorkspaceMember = renamedWireStruct({
  fields: {
    principalId: PrincipalId,
    name: RecordName,
    role: Schema.Enum(MembershipRole),
    createdAt: Schema.DateTimeUtcFromMillis,
  },
  renames: { principalId: 'principalId', createdAt: 'createdAtMs' },
});

const OWNER_REFUSALS = { NotMember: {}, OwnerRequired: {} } as const;

/** A non-member cannot learn whether the workspace exists. */
export const WorkspaceOwnerRefusal = Schema.TaggedUnion(OWNER_REFUSALS);
export type WorkspaceOwnerRefusal = typeof WorkspaceOwnerRefusal.Type;

/** The directory reads membership and owner authority in one transaction. */
export const WorkspaceMembersAnswer = Schema.TaggedUnion({
  ...OWNER_REFUSALS,
  Listed: { members: Schema.Array(DirectoryWorkspaceMember) },
});

export type WorkspaceMembersAnswer = typeof WorkspaceMembersAnswer.Type;

/** Set and remove remain distinct so absence has an explicit outcome. */
export const WorkspaceMemberChange = Schema.TaggedUnion({ Set: { role: Schema.Enum(MembershipRole) }, Remove: {} });
export type WorkspaceMemberChange = typeof WorkspaceMemberChange.Type;

const MEMBER_CHANGE_REFUSALS = {
  ...OWNER_REFUSALS,
  PersonalWorkspace: {},
  PrincipalMissing: {},
  MemberMissing: {},
  LastOwner: {},
} as const;

/** These outcomes leave every membership unchanged. */
export const WorkspaceMemberChangeRefusal = Schema.TaggedUnion(MEMBER_CHANGE_REFUSALS);

export type WorkspaceMemberChangeRefusal = typeof WorkspaceMemberChangeRefusal.Type;

const MEMBER_CHANGED = { member: DirectoryWorkspaceMember } as const;
const MEMBER_REMOVED = { principalId: PrincipalId } as const;

/** Successful membership mutation and its returned record belong to the same transaction. */
export const WorkspaceMemberChangeAnswer = Schema.TaggedUnion({
  ...MEMBER_CHANGE_REFUSALS,
  Changed: MEMBER_CHANGED,
  Removed: MEMBER_REMOVED,
});

export type WorkspaceMemberChangeAnswer = typeof WorkspaceMemberChangeAnswer.Type;

/** A set call cannot accept a removal result from the directory. */
export const WorkspaceMemberSetAnswer = Schema.TaggedUnion({ ...MEMBER_CHANGE_REFUSALS, Changed: MEMBER_CHANGED });

export type WorkspaceMemberSetAnswer = typeof WorkspaceMemberSetAnswer.Type;

/** A removal call cannot accept a changed-member result from the directory. */
export const WorkspaceMemberRemovalAnswer = Schema.TaggedUnion({ ...MEMBER_CHANGE_REFUSALS, Removed: MEMBER_REMOVED });

export type WorkspaceMemberRemovalAnswer = typeof WorkspaceMemberRemovalAnswer.Type;
