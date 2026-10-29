import { errorCode, writeLog } from '@mechane/logs';
import { BEARER_SCHEME, ErrorBody, errorDetail, ErrorFamily, FAMILY_STATUS, LogEvent } from '@mechane/protocol';
import type { ServerFailure } from '@mechane/protocol';
import { HttpHeader } from '@mechane/records';
import { Match, Schema } from 'effect';

/** One header of a failure's answer: its name and value. */
type FailureHeader = readonly [HttpHeader, string];

/** The headers each failure answers with, by its tag. */
type FailureHeaders = {
  readonly [T in ServerFailure['_tag']]: (
    failure: Extract<ServerFailure, Readonly<Record<'_tag', T>>>,
  ) => ReadonlyArray<FailureHeader>;
};

type RespondFailureInput = { readonly failure: ServerFailure; readonly message: string };

/** The challenge of a request that sent a key the directory refuses, which a request that sent none never gets. */
const INVALID_KEY_CHALLENGE: ReadonlyArray<FailureHeader> = [
  [HttpHeader.WwwAuthenticate, `${BEARER_SCHEME} error="invalid_token"`],
];

/**
 * The headers of each failure's answer: every unauthenticated one challenges with the bearer scheme, and a rate limit
 * names the wait it asks for.
 */
const FAILURE_HEADERS: Readonly<FailureHeaders> = {
  WatchNotFound: () => [],
  WatchLimitReached: () => [],
  WorkspaceOwnerRequired: () => [],
  ConnectionNotFound: () => [],
  ConnectionLimitReached: () => [],
  ToolGrantInvalid: () => [],
  RouteNotFound: () => [],
  RateLimited: ({ retryAfterSeconds }) => [[HttpHeader.RetryAfter, String(retryAfterSeconds)]],
  RequestInvalid: () => [],
  WorkerMisconfigured: () => [],
  ObjectUnavailable: () => [],
  ReleaseFileNotFound: () => [],
  ReleasesBucketUnavailable: () => [],
  KeyMissing: () => [[HttpHeader.WwwAuthenticate, BEARER_SCHEME]],
  KeyUnrecognized: () => INVALID_KEY_CHALLENGE,
  KeyRevoked: () => INVALID_KEY_CHALLENGE,
  KeyExpired: () => INVALID_KEY_CHALLENGE,
  DeviceApprovalNotFound: () => [],
  KeyNotFound: () => [],
  WorkspaceNotFound: () => [],
  WorkspaceSuspended: () => [],
  MechNotFound: () => [],
  MechBusy: () => [],
  MechRevisionConflict: () => [],
  MechCreationConflict: () => [],
  MechArchived: () => [],
  ModelInvalid: () => [],
  InboxItemConflict: () => [],
  TurnNotFound: () => [],
  TurnEnded: () => [],
  DroneNotFound: () => [],
  DroneEnded: () => [],
};

/**
 * Answers with the failure's family status, its headers, and an error body whose code is the failure's tag, beside its
 * own fields. A failure of the deployment itself is logged by its code, never its message.
 */
export function respondFailure({ failure, message }: RespondFailureInput): Response {
  const detail = errorDetail({ failure, message });
  const { family } = detail;
  const status = FAMILY_STATUS[family];
  const headers = new Headers(Match.valueTags(failure, FAILURE_HEADERS));

  if (family === ErrorFamily.Unavailable) {
    writeLog({ line: { event: LogEvent.RequestFailed, code: errorCode({ error: failure }), status } });
  }

  return Response.json(Schema.encodeSync(ErrorBody)({ error: detail }), { status, headers });
}
