import {
  bearerAuthorization,
  ExternalRequestRecovery,
  ExternalRequestStatus,
  ExternalRequestUnavailable,
} from '@mechane/protocol';
import { BYTES_PER_KIBIBYTE, HttpHeader, HttpStatusCode, MediaType } from '@mechane/records';
import { capturePromise } from '@mechane/utilities';
import { Duration, Option, Redacted, Result, Schema } from 'effect';
import { boundRemoteResponse } from '../http/bound-remote-response.ts';
import { serviceRequestUrl } from './service-request-url.ts';
import type { RequestServiceOutcome, ServiceRequestInput } from './types.ts';

const REQUEST_TIMEOUT = Duration.seconds(15);
const RESPONSE_MAX_BYTES = 32 * BYTES_PER_KIBIBYTE;

/** Only the owner-selected collection receives the host credential; mutations reuse their recorded request ID. */
export async function readServiceRequest({
  service,
  kind,
  requestId,
  method,
  body,
  token,
}: ServiceRequestInput): Promise<RequestServiceOutcome> {
  const sent = sendServiceRequest({ service, kind, requestId, method, body, token });
  const result = await capturePromise({ promise: sent });

  return Result.getOrElse(result, () => {
    const failure = new ExternalRequestUnavailable({
      reason: 'The request service could not be reached within its time and response limits',
      recovery: ExternalRequestRecovery.Retry,
    });

    return Result.fail(failure);
  });
}

async function sendServiceRequest({
  service,
  kind,
  requestId,
  method,
  body,
  token,
}: ServiceRequestInput): Promise<RequestServiceOutcome> {
  const url = serviceRequestUrl({ service, kind, requestId, body });
  const credential = Redacted.value(token);
  const authorization = bearerAuthorization({ token: credential });

  const headers = new Headers({ [HttpHeader.Authorization]: authorization, [HttpHeader.ContentType]: MediaType.Json });

  const timeout = Duration.toMillis(REQUEST_TIMEOUT);
  const signal = AbortSignal.timeout(timeout);
  const payload = Option.getOrNull(body);
  const request = new Request(url, { method, headers, body: payload, signal, redirect: 'manual' });
  const fetched = await fetch(request);
  const received = { bytes: 0 };

  function accept({ bytes }: ByteCount): boolean {
    received.bytes += bytes;

    return received.bytes <= RESPONSE_MAX_BYTES;
  }

  const response = await boundRemoteResponse({ response: fetched, accept });
  const serialized = await response.text();

  if (!response.ok) {
    const recovery = requestRecovery({ status: response.status });

    const failure = new ExternalRequestUnavailable({
      reason: `The request service refused this operation (${response.status})`,
      recovery,
    });

    return Result.fail(failure);
  }

  const sanitized = serialized.replaceAll(credential, '[redacted]');
  const responseSchema = Schema.fromJsonString(ExternalRequestStatus);
  const decoded = Schema.decodeUnknownResult(responseSchema)(sanitized);

  if (Result.isFailure(decoded) || decoded.success.id !== requestId || decoded.success.kind !== kind) {
    const failure = new ExternalRequestUnavailable({
      reason: 'The request service returned an invalid status',
      recovery: ExternalRequestRecovery.Stop,
    });

    return Result.fail(failure);
  }

  return Result.succeed(decoded.success);
}

type ByteCount = { readonly bytes: number };
type RequestRecoveryInput = { readonly status: number };

function requestRecovery({ status }: RequestRecoveryInput): ExternalRequestRecovery {
  if (status === HttpStatusCode.TooManyRequests || status >= HttpStatusCode.InternalServerError) {
    return ExternalRequestRecovery.Retry;
  }

  if (status === HttpStatusCode.NotFound) {
    return ExternalRequestRecovery.Missing;
  }

  return ExternalRequestRecovery.Stop;
}
