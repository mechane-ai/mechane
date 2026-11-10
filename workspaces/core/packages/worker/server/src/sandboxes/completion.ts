import { RequestInvalid } from '@mechane/protocol';
import type { MechActorResolver, RuntimeConfiguration } from '@mechane/runtime';
import { SANDBOX_COMPLETION_PATH, SandboxCompletion, SandboxCompletionAccepted } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { createInternalPostHandler } from '../http/internal-post.ts';

const COMPLETION_MAX_BYTES = 4096;

export function createSandboxCompletionHandler(input: {
  readonly configuration: RuntimeConfiguration;
  readonly actors: MechActorResolver;
}) {
  return createInternalPostHandler({
    pathname: SANDBOX_COMPLETION_PATH,
    bearer: input.configuration.sandbox.bearer,
    maximumBytes: COMPLETION_MAX_BYTES,
    respond: async (body) => {
      const decoded = Schema.decodeUnknownResult(Schema.fromJsonString(SandboxCompletion), {
        onExcessProperty: 'error',
      })(body);

      if (decoded._tag === 'Failure') {
        throw new RequestInvalid({ reason: 'The environment completion is invalid' });
      }

      await input.actors(decoded.success).acceptCompletion(decoded.success);

      return Schema.encodeSync(SandboxCompletionAccepted)({ accepted: true });
    },
  });
}
