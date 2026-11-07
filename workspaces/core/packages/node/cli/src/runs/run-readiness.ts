import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { Effect, Option } from 'effect';

/** Reports the deployment release and runtime and storage revisions without a key. */
export const runReadiness = Effect.fn('runReadiness')(function* ({
  call,
}: RunInput<'readiness'>): Effect.fn.Return<CommandResult<'readiness'>, RunFailure> {
  const readiness = yield* call({ name: 'readiness', input: {}, credential: Option.none() });

  return {
    lines: [
      `release ${readiness.release}`,
      `runtime revision ${readiness.runtimeRevision}`,
      `storage revision ${readiness.storageRevision}`,
    ],
    result: readiness,
  };
});
