import { ConnectionId, memberOrUnknown, RecordId, WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';
import { DurableObjectClass } from '../durable-objects/constants.ts';
import { UnknownFields, WireTime } from '../schemas.ts';
import {
  DroneEnded,
  DroneNotFound,
  MechArchived,
  MechCreationConflict,
  MechRevisionConflict,
  ModelInvalid,
  SandboxCapacityReached,
  SandboxDisabled,
  TurnEnded,
  TurnNotFound,
  WatchLimitReached,
  WatchNotFound,
} from './mech.errors.ts';

/** No operation of the catalog serves the request's method and path. */
export class RouteNotFound extends Schema.TaggedError<RouteNotFound>()('RouteNotFound', {
  method: Schema.String,
  path: Schema.String,
}) {}

/** The request's path parameters, query or body do not decode with its operation's schemas. */
export class RequestInvalid extends Schema.TaggedError<RequestInvalid>()('RequestInvalid', { reason: Schema.String }) {}

/** The Worker's bindings and variables do not decode into its settings. */
export class WorkerMisconfigured extends Schema.TaggedError<WorkerMisconfigured>()('WorkerMisconfigured', {
  reason: Schema.String,
}) {}

/** A Durable Object did not answer the Worker's call. */
export class ObjectUnavailable extends Schema.TaggedError<ObjectUnavailable>()('ObjectUnavailable', {
  objectClass: memberOrUnknown({ set: DurableObjectClass }),
  reason: Schema.String,
}) {}

/** No release published a file at the key the request names. */
export class ReleaseFileNotFound extends Schema.TaggedError<ReleaseFileNotFound>()('ReleaseFileNotFound', {
  key: Schema.String,
}) {}

/** The releases bucket did not answer the Worker's read of a release file. */
export class ReleasesBucketUnavailable extends Schema.TaggedError<ReleasesBucketUnavailable>()(
  'ReleasesBucketUnavailable',
  { key: Schema.String, reason: Schema.String },
) {}

/** A principal operation's request carries no key. */
export class KeyMissing extends Schema.TaggedError<KeyMissing>()('KeyMissing', {}) {}

/** The request's key is malformed or names no key of this deployment. */
export class KeyUnrecognized extends Schema.TaggedError<KeyUnrecognized>()('KeyUnrecognized', {}) {}

/** The request's key was revoked; revocation is permanent. */
export class KeyRevoked extends Schema.TaggedError<KeyRevoked>()('KeyRevoked', {}) {}

/** The request's key expired at `expiresAt`. */
export class KeyExpired extends Schema.TaggedError<KeyExpired>()('KeyExpired', { expiresAt: WireTime }) {}

/** No device approval with the poll token awaits a poll: it expired, a poll claimed it, or it never existed. */
export class DeviceApprovalNotFound extends Schema.TaggedError<DeviceApprovalNotFound>()(
  'DeviceApprovalNotFound',
  {},
) {}

/** The caller sent more requests than a policy allows in its window; `retryAfterSeconds` is when the next one fits. */
export class RateLimited extends Schema.TaggedError<RateLimited>()('RateLimited', { retryAfterSeconds: Schema.Int }) {}

/** The caller owns no key with this id; another principal's key answers the same. */
export class KeyNotFound extends Schema.TaggedError<KeyNotFound>()('KeyNotFound', { keyId: RecordId }) {}

/** The caller's principal belongs to no workspace with this id; one that exists answers the same to a non-member. */
export class WorkspaceNotFound extends Schema.TaggedError<WorkspaceNotFound>()('WorkspaceNotFound', {
  workspaceId: RecordId,
}) {}

/** The deployment's operator suspended the workspace, so no member's call reaches it until a deploy lifts that. */
export class WorkspaceSuspended extends Schema.TaggedError<WorkspaceSuspended>()('WorkspaceSuspended', {
  workspaceId: RecordId,
}) {}

/** The workspace has no mech with this id. */
export class MechNotFound extends Schema.TaggedError<MechNotFound>()('MechNotFound', { mechId: RecordId }) {}

/**
 * The mech is not idle, so it cannot be forked now. A turn runs or owes its note, an inbox item waits for a turn or
 * holds one, or a drone runs or its machine has not stopped.
 */
export class MechBusy extends Schema.TaggedError<MechBusy>()('MechBusy', { mechId: RecordId }) {}

/**
 * The mech already holds an inbox item with this id and another text or delivery, so the send is not a retry of that
 * one.
 */
export class InboxItemConflict extends Schema.TaggedError<InboxItemConflict>()('InboxItemConflict', {
  inboxItemId: RecordId,
}) {}

/**
 * An error whose code this release does not know, such as one a newer deployment added. It holds its code and the
 * fields the wire gave it, which a client reads by the family beside them.
 */
export class UnknownFailure extends Schema.TaggedError<UnknownFailure>()('UnknownFailure', {
  code: Schema.String,
  fields: UnknownFields,
}) {}

/** Live membership exists, but the requested administration operation requires owner authority. */
export class WorkspaceOwnerRequired extends Schema.TaggedError<WorkspaceOwnerRequired>()('WorkspaceOwnerRequired', {
  workspaceId: WorkspaceId,
}) {}

/** The requested connection is absent from the admitted workspace. */
export class ConnectionNotFound extends Schema.TaggedError<ConnectionNotFound>()('ConnectionNotFound', {
  connectionId: ConnectionId,
}) {}

/** The workspace cannot create another connection until one is removed. */
export class ConnectionLimitReached extends Schema.TaggedError<ConnectionLimitReached>()(
  'ConnectionLimitReached',
  {},
) {}

/** A requested name lies outside the connection's owner-approved selection. */
export class ToolGrantInvalid extends Schema.TaggedError<ToolGrantInvalid>()('ToolGrantInvalid', {
  connectionId: ConnectionId,
}) {}

/** Every failure the Worker answers with; a client decodes a code it knows into the failure with its fields. */
export const ServerFailure = Schema.Union([
  WorkspaceOwnerRequired,
  ConnectionNotFound,
  ConnectionLimitReached,
  ToolGrantInvalid,
  RouteNotFound,
  RequestInvalid,
  WorkerMisconfigured,
  ObjectUnavailable,
  ReleaseFileNotFound,
  ReleasesBucketUnavailable,
  KeyMissing,
  KeyUnrecognized,
  KeyRevoked,
  KeyExpired,
  RateLimited,
  WorkspaceNotFound,
  WorkspaceSuspended,
  SandboxDisabled,
  SandboxCapacityReached,
  DeviceApprovalNotFound,
  KeyNotFound,
  MechNotFound,
  WatchNotFound,
  WatchLimitReached,
  MechBusy,
  MechRevisionConflict,
  MechCreationConflict,
  MechArchived,
  ModelInvalid,
  InboxItemConflict,
  TurnNotFound,
  TurnEnded,
  DroneNotFound,
  DroneEnded,
]);

export type ServerFailure = typeof ServerFailure.Type;
