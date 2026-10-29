import { KeyPurpose, MembershipRole } from '@mechane/protocol';
import { BrowserIdentity, DirectoryPrincipal, Micros } from '@mechane/records';
import { Schema } from 'effect';

/**
 * A key as the directory reports it, which decodes into the wire's key metadata; the object sends its stored times as
 * epoch milliseconds and its owner beside the key.
 */
export const DirectoryKey = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  purpose: Schema.Enum(KeyPurpose),
  createdAt: Schema.DateTimeUtcFromMillis,
  expiresAt: Schema.DateTimeUtcFromMillis,
  /** When the key was revoked, none while it is not. */
  revokedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
}).pipe(Schema.encodeKeys({ createdAt: 'createdAtMs', expiresAt: 'expiresAtMs', revokedAt: 'revokedAtMs' }));

export type DirectoryKey = typeof DirectoryKey.Type;

/** A principal's workspaces as the directory answers them: at least its personal one. */
export const DirectoryWorkspace = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  role: Schema.Enum(MembershipRole),
  dailyAllowanceMicros: Micros,
  createdAt: Schema.DateTimeUtcFromMillis,
}).pipe(Schema.encodeKeys({ createdAt: 'createdAtMs' }));

export type DirectoryWorkspace = typeof DirectoryWorkspace.Type;

/** The principal's personal workspace comes first, followed by shared memberships. */
export const DirectoryWorkspaces = Schema.NonEmptyArray(DirectoryWorkspace);

export type DirectoryWorkspaces = typeof DirectoryWorkspaces.Type;

/** The directory's current membership decision; cached key metadata cannot grant workspace access. */
export const WorkspaceMembership = Schema.TaggedUnion({ Member: { role: Schema.Enum(MembershipRole) }, NotMember: {} });

export type WorkspaceMembership = typeof WorkspaceMembership.Type;

/** The token's hash of the caller's key with an id, which its revocation tombstones first, or no such key. */
export const KeyTokenAnswer = Schema.TaggedUnion({ Found: { tokenHash: Schema.String }, NotFound: {} });

export type KeyTokenAnswer = typeof KeyTokenAnswer.Type;

/** A session's verified identity, or signed out when its token has no unexpired session. */
export const LiveSession = Schema.TaggedUnion({ Live: BrowserIdentity.fields, SignedOut: {} });

export type LiveSession = typeof LiveSession.Type;

/** A device approval that awaits a browser's approval, as its review shows it: what it issues and when it began. */
const Pending = Schema.TaggedStruct('Pending', {
  purpose: Schema.Enum(KeyPurpose),
  keyName: Schema.String,
  keyLifetime: Schema.DurationFromMillis,
  createdAt: Schema.DateTimeUtcFromMillis,
  /** The address of the client that started it, none where the platform reported none. */
  peerAddress: Schema.OptionFromNullOr(Schema.String),
  /** The country of the client that started it, none where the platform reported none. */
  peerCountry: Schema.OptionFromNullOr(Schema.String),
}).pipe(Schema.encodeKeys({ keyLifetime: 'keyLifetimeMs', createdAt: 'createdAtMs' }));

/** A device approval that awaits a browser's approval, as the directory answers its review. */
export type Pending = typeof Pending.Type;

/** A sign-in the return from GitHub claimed, or no unexpired sign-in with the state. */
export const SignInClaim = Schema.TaggedUnion({ Claimed: {}, Unclaimable: {} });

export type SignInClaim = typeof SignInClaim.Type;

/** What a poll found: an approval still pending, the key it just claimed, or nothing it can claim. */
export const ApprovalClaim = Schema.TaggedUnion({
  Pending: {},
  Claimed: { key: DirectoryKey, principal: DirectoryPrincipal },
  Unclaimable: {},
});

export type ApprovalClaim = typeof ApprovalClaim.Type;

/**
 * What an approval did: approved the request, as the principal that approved it, or refused because the session or the
 * request is gone.
 */
export const ApprovalDecision = Schema.TaggedUnion({
  Approved: { purpose: Schema.Enum(KeyPurpose), keyName: Schema.String, principal: DirectoryPrincipal },
  SignedOut: {},
  NotPending: {},
});

export type ApprovalDecision = typeof ApprovalDecision.Type;

/** An approval that went through: what it approved, and the principal that approved it. */
export type Approved = typeof ApprovalDecision.cases.Approved.Type;

/**
 * A page of a principal's keys as the directory answers it, oldest first, which decodes into the wire's page, or a
 * cursor that names no key of theirs.
 */
export const DirectoryKeyPage = Schema.TaggedUnion({
  Listed: { keys: Schema.Array(DirectoryKey), hasMore: Schema.Boolean },
  CursorMissing: {},
});

export type DirectoryKeyPage = typeof DirectoryKeyPage.Type;

/** What a revocation found: the caller's key with the id, now revoked, or no key of the caller with the id. */
export const KeyRevocation = Schema.TaggedUnion({ Revoked: { key: DirectoryKey }, NotFound: {} });

export type KeyRevocation = typeof KeyRevocation.Type;

/** The device approval with a user code, or none with it that still awaits a browser's approval. */
export const PendingApproval = Schema.Union([Pending, Schema.TaggedStruct('NotPending', {})]).pipe(
  Schema.toTaggedUnion('_tag'),
);

export type PendingApproval = typeof PendingApproval.Type;
