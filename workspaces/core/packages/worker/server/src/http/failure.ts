import {
  ErrorBody,
  errorDetail,
  ErrorFamily,
  FAMILY_STATUS,
  RequestConflict,
  RequestInvalid,
  ServerFailure,
  ServiceUnavailable,
} from '@mechane/protocol';
import { HttpHeader } from '@mechane/records';
import { DateTime, Duration, Schema } from 'effect';
import { authenticationChallenge } from './authentication-challenge.ts';

type FailureResponseInput = { readonly failure: unknown; readonly request: Request };
const UNAVAILABLE_MESSAGE = 'The service could not complete this request';
const ReasonFailure = Schema.Union([RequestInvalid, RequestConflict]);

const PostgresErrorMetadata = Schema.Struct({
  code: Schema.String.check(Schema.isPattern(/^[0-9A-Z]{5}$/u)),
  severity: Schema.Literals(['ERROR', 'FATAL', 'PANIC']),
});

const FAILURE_MESSAGES: Readonly<Partial<Record<ServerFailure['_tag'], string>>> = {
  KeyMissing: 'Sign in to continue, or run mechane auth login.',
  KeyUnrecognized: 'The API key is not recognized. Run mechane auth login to replace it.',
  KeyRevoked: 'The API key was revoked. Run mechane auth login to replace it.',
  IdentityNotAdmitted: 'This identity is not admitted to the installation.',
  WorkspaceNotFound: 'The workspace is not available to this account.',
  WorkspaceOwnerRequired: 'A workspace owner is required for this operation.',
  DeviceApprovalNotFound: 'The device approval expired or was already claimed. Start again in the CLI.',
  ServiceUnavailable: UNAVAILABLE_MESSAGE,
};

function failureMessage(failure: ServerFailure): string {
  if (failure._tag === 'KeyExpired') {
    return `The API key expired at ${DateTime.formatIso(failure.expiresAt)}. Run mechane auth login to replace it.`;
  }

  if (Schema.is(ReasonFailure)(failure)) {
    return failure.reason;
  }

  if (failure._tag === 'RateLimited') {
    const seconds = Math.ceil(Duration.toSeconds(failure.retryAfterSeconds));

    return `Too many requests. Try again in ${seconds} seconds.`;
  }

  return FAILURE_MESSAGES[failure._tag] ?? failure._tag;
}

function publicFailure({ failure, request }: FailureResponseInput): ServerFailure {
  if (Schema.is(ServerFailure)(failure)) {
    return failure;
  }

  console.error({
    event: 'request.failed',
    method: request.method,
    path: new URL(request.url).pathname,
    errorType: failureType(failure),
    ...postgresFailureMetadata(failure),
  });

  return new ServiceUnavailable({ reason: UNAVAILABLE_MESSAGE });
}

export function respondFailure({ failure, request }: FailureResponseInput): Response {
  const headers = new Headers({ [HttpHeader.CacheControl]: 'no-store' });
  const reported = publicFailure({ failure, request });
  const detail = errorDetail({ failure: reported, message: failureMessage(reported) });

  if (detail.family === ErrorFamily.Unauthenticated) {
    headers.set(HttpHeader.WwwAuthenticate, authenticationChallenge({ request }));
  }

  if (reported._tag === 'RateLimited') {
    const seconds = Math.ceil(Duration.toSeconds(reported.retryAfterSeconds));

    headers.set(HttpHeader.RetryAfter, String(seconds));
  }

  return Response.json(Schema.encodeSync(ErrorBody)({ error: detail }), {
    status: FAMILY_STATUS[detail.family],
    headers,
  });
}

function failureType(failure: unknown): string {
  if (failure instanceof Error) {
    return failure.name;
  }

  return 'UnknownFailure';
}

type SessionDeliveryFailure = {
  readonly operation: 'open' | 'dispatch';
  readonly failure: unknown;
  readonly workspaceId: string;
  readonly sessionId: string;
};

export function reportSessionDeliveryFailure({
  operation,
  failure,
  workspaceId,
  sessionId,
}: SessionDeliveryFailure): void {
  console.error({
    event: 'managed.session.delivery_failed',
    operation,
    workspaceId,
    sessionId,
    errorType: failureType(failure),
  });
}

export function reportRecoveryFailure(step: string, failure: unknown): void {
  console.error({
    event: 'managed.recovery.failed',
    step,
    errorType: failureType(failure),
    ...postgresFailureMetadata(failure),
  });
}

function postgresFailureMetadata(failure: unknown) {
  if (!Schema.is(PostgresErrorMetadata)(failure)) {
    return {};
  }

  return { sqlState: failure.code, severity: failure.severity };
}
