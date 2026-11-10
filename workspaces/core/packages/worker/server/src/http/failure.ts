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
import { DateTime, Schema } from 'effect';
import { CONFIGURATION_UNCONFIRMED_REASON } from '../control/deliver-changes.ts';
import { authenticationChallenge } from './authentication-challenge.ts';

type FailureResponseInput = { readonly failure: unknown; readonly request: Request };
const UNAVAILABLE_MESSAGE = 'The service could not complete this request';
const ReasonFailure = Schema.Union([RequestInvalid, RequestConflict]);

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
  if (failure._tag === 'ServiceUnavailable' && failure.reason === CONFIGURATION_UNCONFIRMED_REASON) {
    return CONFIGURATION_UNCONFIRMED_REASON;
  }

  if (failure._tag === 'KeyExpired') {
    return `The API key expired at ${DateTime.formatIso(failure.expiresAt)}. Run mechane auth login to replace it.`;
  }

  if (Schema.is(ReasonFailure)(failure)) {
    return failure.reason;
  }

  if (failure._tag === 'RateLimited') {
    return `Too many requests. Try again in ${failure.retryAfterSeconds} seconds.`;
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
    headers.set(HttpHeader.RetryAfter, String(reported.retryAfterSeconds));
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
