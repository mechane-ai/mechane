import { RequestInvalid } from '@mechane/protocol';
import type { RuntimeStore } from '@mechane/runtime';
import { SANDBOX_CAPACITY_PATH, SandboxCapacityRequest, SandboxCapacityResult } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import type { Redacted } from 'effect';
import { createInternalPostHandler } from '../http/internal-post.ts';

const CAPACITY_BODY_MAX_BYTES = 1024;

type CapacityHandlerInput = {
  readonly bearer: Redacted.Redacted;
  readonly acquire: RuntimeStore['acquireSandboxCapacity'];
  readonly release: RuntimeStore['releaseSandboxCapacity'];
};

export function createSandboxCapacityHandler({ bearer, acquire, release }: CapacityHandlerInput) {
  const mutations = { acquire, release };

  return createInternalPostHandler({
    pathname: SANDBOX_CAPACITY_PATH,
    bearer,
    maximumBytes: CAPACITY_BODY_MAX_BYTES,
    respond: async (body) => {
      const decoded = Schema.decodeUnknownResult(Schema.fromJsonString(SandboxCapacityRequest))(body);

      if (decoded._tag === 'Failure') {
        throw new RequestInvalid({ reason: 'The sandbox capacity request is invalid' });
      }

      const { action, ...identity } = decoded.success;
      const result = await mutations[action](identity);

      return Schema.encodeSync(SandboxCapacityResult)(result);
    },
  });
}
