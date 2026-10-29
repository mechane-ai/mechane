import { KeyPurpose, KeyRow, MembershipRole } from '@mechane/protocol';
import { Micros, renamedWireStruct, wireStruct } from '@mechane/records';
import { Schema } from 'effect';

/** A device approval as polls, reviews and approvals read it. */
export const DeviceApprovalRow = renamedWireStruct({
  fields: {
    id: Schema.String,
    purpose: Schema.Enum(KeyPurpose),
    keyName: Schema.String,
    keyLifetime: Schema.DurationFromMillis,
    createdAt: Schema.DateTimeUtcFromMillis,
    /** The address of the client that started it, none where the platform reported none. */
    peerAddress: Schema.OptionFromNullOr(Schema.String),
    /** The country of the client that started it, none where the platform reported none. */
    peerCountry: Schema.OptionFromNullOr(Schema.String),
    /** The principal that approved it, none while it is pending. */
    approverId: Schema.OptionFromNullOr(Schema.String),
  },
  renames: { keyLifetime: 'key_lifetime_ms', createdAt: 'created_at_ms' },
});

export type DeviceApprovalRow = typeof DeviceApprovalRow.Type;

/** A page of a principal's keys as the store reads them, oldest first, or a cursor that names no key of theirs. */
export const KeyRowPage = Schema.TaggedUnion({
  Listed: { keys: Schema.Array(Schema.toType(KeyRow)), hasMore: Schema.Boolean },
  CursorMissing: {},
});

export type KeyRowPage = typeof KeyRowPage.Type;

/** A sign-in that a return from GitHub claimed, by the hash of its state. */
export const ClaimedSignInRow = wireStruct({ fields: { stateHash: Schema.String } });

export type ClaimedSignInRow = typeof ClaimedSignInRow.Type;

/** A principal: its id, and the name it signed up with. */
export const PrincipalRow = wireStruct({ fields: { id: Schema.String, name: Schema.String } });

export type PrincipalRow = typeof PrincipalRow.Type;

/** A workspace of a principal, with the principal's role in it, its daily allowance and when it was created. */
export const WorkspaceRow = renamedWireStruct({
  fields: {
    id: Schema.String,
    name: Schema.String,
    role: Schema.Enum(MembershipRole),
    dailyAllowanceMicros: Micros,
    createdAt: Schema.DateTimeUtcFromMillis,
  },
  renames: { createdAt: 'created_at_ms' },
});

export type WorkspaceRow = typeof WorkspaceRow.Type;
