import { HttpHeader, HttpMethod } from '@mechane/records';
import type { Redacted } from 'effect';
import { readTextBody } from './body.ts';
import { respondFailure } from './failure.ts';
import { refuseInternalRequest } from './internal-authorization.ts';

type InternalPostInput = {
  readonly pathname: string;
  readonly bearer: Redacted.Redacted;
  readonly maximumBytes: number;
  readonly respond: (body: string) => Promise<unknown>;
};

export function createInternalPostHandler({ pathname, bearer, maximumBytes, respond }: InternalPostInput) {
  return async function internalPost(request: Request): Promise<Response | null> {
    if (new URL(request.url).pathname !== pathname) {
      return null;
    }

    const headers = { [HttpHeader.CacheControl]: 'no-store' };

    const refusal = refuseInternalRequest({ request, bearer, method: HttpMethod.Post });

    if (refusal !== null) {
      return refusal;
    }

    try {
      const body = await readTextBody(request, maximumBytes);

      return Response.json(await respond(body), { headers });
    } catch (failure) {
      return respondFailure({ failure, request });
    }
  };
}
