import { ManagedStoreError } from '@mechane/control-store';
import { RequestInvalid } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { ManagedRuntimeError } from '@mechane/runtime';
import { respondFailure } from '../http/failure.ts';
import { ManagedHttpError } from './http-error.ts';

const kinds: Readonly<Record<number, string>> = {
  [HttpStatusCode.BadRequest]: 'invalid_request_error',
  [HttpStatusCode.Unauthorized]: 'authentication_error',
  [HttpStatusCode.PaymentRequired]: 'billing_error',
  [HttpStatusCode.Forbidden]: 'permission_error',
  [HttpStatusCode.NotFound]: 'not_found_error',
  [HttpStatusCode.MethodNotAllowed]: 'invalid_request_error',
  [HttpStatusCode.RequestTimedOut]: 'timeout_error',
  [HttpStatusCode.Conflict]: 'conflict_error',
  [HttpStatusCode.PreconditionFailed]: 'invalid_request_error',
  [HttpStatusCode.PayloadTooLarge]: 'request_too_large',
  [HttpStatusCode.UnprocessableEntity]: 'invalid_request_error',
  [HttpStatusCode.TooManyRequests]: 'rate_limit_error',
  [HttpStatusCode.Unavailable]: 'overloaded_error',
  [HttpStatusCode.GatewayTimedOut]: 'timeout_error',
  [HttpStatusCode.Overloaded]: 'overloaded_error',
};

type Failure = { readonly status: number; readonly message: string };

function publicDetails(failure: Failure) {
  if (failure instanceof ManagedStoreError) {
    return failure.wireError;
  }

  return null;
}

function managedError(failure: Failure, requestId: string, headers?: Headers) {
  const { status, message } = failure;
  const details = publicDetails(failure);
  const output = new Headers(headers);

  output.set(HttpHeader.RequestId, requestId);
  output.set(HttpHeader.CacheControl, 'no-store');

  return Response.json(
    { type: 'error', error: { type: kinds[status] ?? 'api_error', message, ...details }, request_id: requestId },
    { status, headers: output },
  );
}

export function managedFailure(failure: unknown, request: Request, requestId: string): Response {
  if (failure instanceof ManagedHttpError) {
    return managedError(failure, requestId, failure.headers);
  }

  if (failure instanceof ManagedStoreError || failure instanceof ManagedRuntimeError) {
    return managedError(failure, requestId);
  }

  if (failure instanceof RequestInvalid) {
    if (failure.reason.includes('exceeds the allowed size')) {
      return managedError({ status: HttpStatusCode.PayloadTooLarge, message: failure.reason }, requestId);
    }

    return managedError({ status: HttpStatusCode.BadRequest, message: failure.reason }, requestId);
  }

  const original = respondFailure({ failure, request });
  const headers = new Headers();

  for (const name of [HttpHeader.RetryAfter, HttpHeader.WwwAuthenticate]) {
    const value = original.headers.get(name);

    if (value !== null) {
      headers.set(name, value);
    }
  }

  const safeMessages: Readonly<Record<number, string>> = {
    [HttpStatusCode.Unauthorized]: 'Invalid authentication credentials',
    [HttpStatusCode.Forbidden]: 'Permission denied',
    [HttpStatusCode.NotFound]: 'Resource not found',
    [HttpStatusCode.TooManyRequests]: 'Too many requests',
    [HttpStatusCode.Unavailable]: 'Service unavailable',
  };

  return managedError(
    { status: original.status, message: safeMessages[original.status] ?? 'Unable to complete request' },
    requestId,
    headers,
  );
}
