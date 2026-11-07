import { RequestInvalid } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { hashAuthToken } from '@mechane/runtime';
import type { RuntimeStore } from '@mechane/runtime';
import { SANDBOX_CAPACITY_PATH, SandboxCapacityRequest, SandboxCapacityResult } from '@mechane/sandbox-wire';
import { Redacted, Schema } from 'effect';
import { timingSafeEqual } from 'node:crypto';
import { readTextBody } from '../http/body.ts';
import { respondFailure } from '../http/failure.ts';

const CAPACITY_BODY_MAX_BYTES = 1024;

type CapacityHandlerInput = {
  readonly bearer: Redacted.Redacted;
  readonly acquire: RuntimeStore['acquireSandboxCapacity'];
  readonly release: RuntimeStore['releaseSandboxCapacity'];
};

export function createSandboxCapacityHandler({ bearer, acquire, release }: CapacityHandlerInput) {
  const expectedHash = Buffer.from(hashAuthToken(`Bearer ${Redacted.value(bearer)}`), 'hex');
  const mutations = { acquire, release };

  return async function sandboxCapacity(request: Request): Promise<Response | null> {
    if (new URL(request.url).pathname !== SANDBOX_CAPACITY_PATH) {
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
      const body = await readTextBody(request, CAPACITY_BODY_MAX_BYTES);
      const decoded = Schema.decodeUnknownResult(Schema.fromJsonString(SandboxCapacityRequest))(body);

      if (decoded._tag === 'Failure') {
        throw new RequestInvalid({ reason: 'The sandbox capacity request is invalid' });
      }

      const { action, ...identity } = decoded.success;
      const result = await mutations[action](identity);

      return Response.json(Schema.encodeSync(SandboxCapacityResult)(result), { headers });
    } catch (failure) {
      return respondFailure({ failure, request });
    }
  };
}
