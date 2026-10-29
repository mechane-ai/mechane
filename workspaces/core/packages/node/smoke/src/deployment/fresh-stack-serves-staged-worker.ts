import { Readiness } from '@mechane/protocol';
import { check, runCli } from '@mechane/testing';
import type { ScenarioFailure, ScenarioInput } from '@mechane/testing';
import { Effect } from 'effect';

/** Reads the fresh stack's readiness, which must name the staged Worker's revision and each class it migrates. */
export const freshStackServesStagedWorker = Effect.fn('freshStackServesStagedWorker')(function* ({
  stack,
  guarantee,
}: ScenarioInput): Effect.fn.Return<void, ScenarioFailure> {
  const { result: readiness } = yield* runCli({ stack, args: ['readiness'], environment: {}, result: Readiness });
  const reported = new Set<string>(readiness.durableObjects.map((object) => object.objectClass));
  const isOmitted: (objectClass: string) => boolean = (objectClass) => !reported.has(objectClass);
  const missing = stack.durableObjectClasses.filter(isOmitted);

  yield* check({
    name: guarantee,
    conditions: [readiness.workerRevision === stack.workerRevision, missing.length === 0],
    detail: `revision ${readiness.workerRevision}, staged ${stack.workerRevision}; omitted: ${missing.join(', ')}`,
  });
});
