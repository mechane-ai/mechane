import { memberOrUnknown, Micros, RecordId, RecordName, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { WireTime } from '../../schemas.ts';
import { MembershipRole, UTC_DAY_PATTERN } from './constants.ts';

/** A workspace the caller belongs to, with the caller's role and the model spend it may make each day. */
export const Workspace = wireStruct({
  fields: {
    id: RecordId,
    name: RecordName,
    role: memberOrUnknown({ set: MembershipRole }),
    dailyAllowanceMicros: Micros,
    createdAt: WireTime,
  },
});

export type Workspace = typeof Workspace.Type;

/** The caller's workspaces, oldest first: at least the personal one its sign-up made, as no membership is removed. */
export const WorkspaceList = Schema.Struct({ workspaces: Schema.NonEmptyArray(Workspace) });

export type WorkspaceList = typeof WorkspaceList.Type;

/** The path of an operation on one workspace, which admission checks the caller belongs to. */
export const WorkspacePath = wireStruct({ fields: { workspaceId: RecordId } });

export type WorkspacePath = typeof WorkspacePath.Type;

/**
 * The workspace's allowance on one UTC day, and what the day's settled dispatches cost and its open reservations hold
 * together. A dispatch is reserved only while its own reservation fits beside what the day has committed.
 */
export const Allowance = wireStruct({
  fields: {
    day: Schema.String.check(Schema.isPattern(UTC_DAY_PATTERN)),
    dailyAllowanceMicros: Micros,
    committedMicros: Micros,
  },
});

export type Allowance = typeof Allowance.Type;
