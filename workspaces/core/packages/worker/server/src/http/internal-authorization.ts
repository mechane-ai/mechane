import { HttpHeader, HttpStatusCode } from '@mechane/records';
import type { HttpMethod } from '@mechane/records';
import { hashAuthToken } from '@mechane/runtime';
import { Redacted } from 'effect';
import { timingSafeEqual } from 'node:crypto';

type InternalAuthorizationInput = { readonly request: Request; readonly bearer: Redacted.Redacted };

type InternalRequestInput = InternalAuthorizationInput & { readonly method: HttpMethod };

export function refuseInternalRequest(input: InternalRequestInput): Response | null {
  const headers = { [HttpHeader.CacheControl]: 'no-store' };

  if (!isInternalRequest(input)) {
    return new Response(null, { status: HttpStatusCode.Unauthorized, headers });
  }

  if (input.request.method !== input.method) {
    return new Response(null, {
      status: HttpStatusCode.MethodNotAllowed,
      headers: { ...headers, allow: input.method },
    });
  }

  return null;
}

function isInternalRequest({ request, bearer }: InternalAuthorizationInput): boolean {
  const encoder = new TextEncoder();
  const expectedHash = encoder.encode(hashAuthToken(`Bearer ${Redacted.value(bearer)}`));
  const suppliedHash = encoder.encode(hashAuthToken(request.headers.get(HttpHeader.Authorization) ?? ''));

  return timingSafeEqual(suppliedHash, expectedHash);
}
