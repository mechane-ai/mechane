import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { Effect, Option } from 'effect';

/** Reports the deployment's release, its Worker revision and each Durable Object's schema revision, with no key. */
export const runReadiness = Effect.fn('runReadiness')(function* ({
  call,
}: RunInput<'readiness'>): Effect.fn.Return<CommandResult<'readiness'>, RunFailure> {
  const readiness = yield* call({ name: 'readiness', input: {}, credential: Option.none() });

  const objectLine: (object: (typeof readiness.durableObjects)[number]) => string = (object) =>
    `${object.objectClass} schema revision ${object.schemaRevision}`;

  return {
    lines: [
      `release ${readiness.release}`,
      `worker revision ${readiness.workerRevision}`,
      ...readiness.durableObjects.map(objectLine),
    ],
    result: readiness,
  };
});
