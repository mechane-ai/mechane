import { ConnectionId, RecordId, WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';
import { UnknownFields, WireTime } from '../schemas.ts';

/** No operation of the catalog serves the request's method and path. */
export class RouteNotFound extends Schema.TaggedError<RouteNotFound>()('RouteNotFound', {
  method: Schema.String,
  path: Schema.String,
}) {}

/** The request's path parameters, query or body do not decode with its operation's schemas. */
export class RequestInvalid extends Schema.TaggedError<RequestInvalid>()('RequestInvalid', { reason: Schema.String }) {}

/** The immutable operation identity already belongs to a different request payload. */
export class RequestConflict extends Schema.TaggedError<RequestConflict>()('RequestConflict', {
  reason: Schema.String,
}) {}

/** The server cannot start a required dependency with its configured settings. */
export class ServerMisconfigured extends Schema.TaggedError<ServerMisconfigured>()('ServerMisconfigured', {
  reason: Schema.String,
}) {}

/** A required service did not complete the operation. */
export class ServiceUnavailable extends Schema.TaggedError<ServiceUnavailable>()('ServiceUnavailable', {
  reason: Schema.String,
}) {}

/** No release published a file at the key the request names. */
export class ReleaseFileNotFound extends Schema.TaggedError<ReleaseFileNotFound>()('ReleaseFileNotFound', {
  key: Schema.String,
}) {}

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

/** The mech has accepted or active work, so an idle-only operation cannot proceed. */
export class MechBusy extends Schema.TaggedError<MechBusy>()('MechBusy', { mechId: RecordId }) {}

/** A stable notification identity cannot be reused for different content. */
export class NotificationConflict extends Schema.TaggedError<NotificationConflict>()('NotificationConflict', {
  notificationId: RecordId,
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
