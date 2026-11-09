import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { hashAuthToken } from '@mechane/runtime';
import { Redacted } from 'effect';
import { timingSafeEqual } from 'node:crypto';
import { readTextBody } from './body.ts';
import { respondFailure } from './failure.ts';

type InternalPostInput = {
  readonly pathname: string;
  readonly bearer: Redacted.Redacted;
  readonly maximumBytes: number;
  readonly respond: (body: string) => Promise<unknown>;
};

export function createInternalPostHandler({ pathname, bearer, maximumBytes, respond }: InternalPostInput) {
  const expectedHash = Buffer.from(hashAuthToken(`Bearer ${Redacted.value(bearer)}`), 'hex');

  return async function internalPost(request: Request): Promise<Response | null> {
    if (new URL(request.url).pathname !== pathname) {
      return null;
    }

    const headers = { [HttpHeader.CacheControl]: 'no-store' };
    const suppliedHash = Buffer.from(hashAuthToken(request.headers.get(HttpHeader.Authorization) ?? ''), 'hex');

    if (!timingSafeEqual(suppliedHash, expectedHash)) {
      return new Response(null, { status: HttpStatusCode.Unauthorized, headers });
    }

    if (request.method !== HttpMethod.Post) {
      return new Response(null, {
        status: HttpStatusCode.MethodNotAllowed,
        headers: { ...headers, allow: HttpMethod.Post },
      });
    }

    try {
      const body = await readTextBody(request, maximumBytes);

      return Response.json(await respond(body), { headers });
    } catch (failure) {
      return respondFailure({ failure, request });
    }
  };
}
