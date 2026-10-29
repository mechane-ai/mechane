import type { ServerFailure } from '@mechane/protocol';
import { DateTime, Match } from 'effect';

/** How the owner of a refused key replaces it, which every authentication failure's message ends with. */
const RECOVER_KEY =
  'sign in again with mechane auth login, or replace MECHANE_API_KEY with a key from mechane key create';

/** The message of a poll whose device approval no poll can claim any more. */
const APPROVAL_GONE = 'claim the device approval: it expired, or a poll claimed it already; run the command again';

type FailureMessageInput = { readonly failure: ServerFailure };

/** The message of each failure, by its tag. */
type FailureMessages = {
  readonly [T in ServerFailure['_tag']]: (failure: Extract<ServerFailure, Readonly<Record<'_tag', T>>>) => string;
};

/** The message of each failure's error response: the step that failed and its input, the cause, and how to recover. */
const FAILURE_MESSAGES: Readonly<FailureMessages> = {
  WorkspaceOwnerRequired: ({ workspaceId }) => `manage workspace ${workspaceId}: an owner is required`,
  ConnectionNotFound: ({ connectionId }) =>
    `find connection ${connectionId}: the workspace has no connection with this id`,
  ConnectionLimitReached: () => 'create connection: the workspace has reached its connection limit',
  ToolGrantInvalid: ({ connectionId }) =>
    `grant tools from ${connectionId}: a requested tool is outside the connection allowlist`,
  RouteNotFound: ({ method, path }) => `route ${method} ${path}: no operation serves it`,
  RequestInvalid: ({ reason }) => `decode the request: ${reason}`,
  WorkerMisconfigured: ({ reason }) => `decode the Worker settings: ${reason}`,
  ObjectUnavailable: ({ objectClass, reason }) => `call ${objectClass}: ${reason}`,
  RateLimited: ({ retryAfterSeconds }) => `admit the request: it is rate limited; send it in ${retryAfterSeconds}s`,
  ReleaseFileNotFound: ({ key }) => `serve ${key}: no release published it`,
  ReleasesBucketUnavailable: ({ key, reason }) => `read ${key} from the releases bucket: ${reason}`,
  KeyMissing: () => `authenticate the request: it carries no key; ${RECOVER_KEY}`,
  KeyUnrecognized: () => `authenticate the request: no key of this deployment matches; ${RECOVER_KEY}`,
  KeyRevoked: () => `authenticate the request: the key was revoked; ${RECOVER_KEY}`,
  KeyExpired: ({ expiresAt }) =>
    `authenticate the request: the key expired at ${DateTime.formatIso(expiresAt)}; ${RECOVER_KEY}`,
  DeviceApprovalNotFound: () => APPROVAL_GONE,
  KeyNotFound: ({ keyId }) => `revoke key ${keyId}: the caller owns no key with this id`,
  WorkspaceNotFound: ({ workspaceId }) =>
    `admit the caller to workspace ${workspaceId}: it belongs to no such workspace`,
  WorkspaceSuspended: ({ workspaceId }) => `admit the caller to workspace ${workspaceId}: its operator suspended it`,
  MechNotFound: ({ mechId }) => `find mech ${mechId}: the workspace has no mech with this id`,
  WatchNotFound: ({ watchId }) => `find watch ${watchId}: the mech has no watch with this id`,
  WatchLimitReached: ({ mechId }) => `save watch for mech ${mechId}: its watch limit is reached`,
  MechBusy: ({ mechId }) => `fork mech ${mechId}: it is not idle; fork it again once its turns and drones end`,
  MechRevisionConflict: ({ mechId, expectedRevision, currentRevision }) =>
    `update mech ${mechId}: expected revision ${expectedRevision}, current revision is ${currentRevision}`,
  MechCreationConflict: ({ requestId }) => `create mech ${requestId}: this request id already names another creation`,
  MechArchived: ({ mechId }) => `send to mech ${mechId}: it is archived; resume it before sending new work`,
  ModelInvalid: ({ model, offered }) =>
    `create a mech with model ${model}: the deployment offers ${offered.join(', ')}`,
  InboxItemConflict: ({ inboxItemId }) =>
    `send inbox item ${inboxItemId}: the mech holds an item with this id and another text or delivery; send it with a new id`,
  TurnNotFound: ({ turnId }) => `find turn ${turnId}: the mech has no turn with this id`,
  TurnEnded: ({ turnId }) => `cancel turn ${turnId}: it ended before any cancel; mechane turn show shows how`,
  DroneNotFound: ({ droneId }) => `find drone ${droneId}: the mech has no drone with this id`,
  DroneEnded: ({ droneId }) => `cancel drone ${droneId}: it ended before any cancel; mechane drone show shows how`,
};

/** The message of an error response, from the failure's own fields. */
export function failureMessage({ failure }: FailureMessageInput): string {
  return Match.valueTags(failure, FAILURE_MESSAGES);
}
