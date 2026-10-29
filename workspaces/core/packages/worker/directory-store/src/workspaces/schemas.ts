import { MembershipRole } from '@mechane/protocol';
import { Micros, PrincipalId, RecordName, renamedWireStruct, WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';
import { WorkspaceKind } from './constants.ts';

const WorkspaceKindField = Schema.Enum(WorkspaceKind);
const OptionalCreatorId = Schema.OptionFromNullOr(PrincipalId);
const MembershipRoleField = Schema.Enum(MembershipRole);

/** Shared workspace creation retains its creator so retries cannot claim another administrator's workspace. */
export const ManagedWorkspaceRow = renamedWireStruct({
  fields: {
    id: WorkspaceId,
    name: RecordName,
    kind: WorkspaceKindField,
    /** None for personal workspaces, whose ownership comes from their protected membership. */
    creatorId: OptionalCreatorId,
    dailyAllowanceMicros: Micros,
    createdAt: Schema.DateTimeUtcFromMillis,
  },
  renames: { createdAt: 'created_at_ms' },
});

export type ManagedWorkspaceRow = typeof ManagedWorkspaceRow.Type;

/** A current role and the original grant time survive repeated membership updates. */
export const WorkspaceMemberRow = renamedWireStruct({
  fields: {
    principalId: PrincipalId,
    name: RecordName,
    role: MembershipRoleField,
    createdAt: Schema.DateTimeUtcFromMillis,
  },
  renames: { createdAt: 'created_at_ms' },
});

export type WorkspaceMemberRow = typeof WorkspaceMemberRow.Type;
