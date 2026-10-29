import { DeployFailed, DeployStep, PROGRAM, readReadiness } from '@mechane/deploy-kernel';
import { StepSubject, writeDiagnostic } from '@mechane/program';
import type { Readiness } from '@mechane/protocol';
import { Effect, Option, Schedule } from 'effect';
import { READINESS_INTERVAL } from './constants.ts';
import type { AwaitReadinessInput, LoweredClassesInput } from './types.ts';

/**
 * Reads production's readiness until it reports the release at the revision, which proves each class opened and
 * migrated on the new code. No class's schema revision may fall below the one before, and it fails with the last answer
 * once the timeout passes.
 */
export function awaitReadiness({
  origin,
  release,
  revision,
  before,
  timeout,
}: AwaitReadinessInput): Effect.Effect<Readiness, DeployFailed> {
  const step = DeployStep.AwaitReadiness;
  const subjects = [StepSubject.cases.Release.make({ release }), StepSubject.cases.Revision.make({ revision })];
  const failure = { step, subjects };

  return readReadiness({ origin }).pipe(
    Effect.mapError(({ reason }) => new DeployFailed({ ...failure, reason })),
    Effect.filterOrFail(
      (readiness) => readiness.release === release && readiness.workerRevision === revision,
      (readiness) =>
        new DeployFailed({ ...failure, reason: `it reports ${readiness.release} at ${readiness.workerRevision}` }),
    ),
    Effect.filterOrFail(
      (readiness) => loweredClasses({ before, readiness }).length === 0,
      (readiness) =>
        new DeployFailed({ ...failure, reason: `${loweredClasses({ before, readiness }).join(', ')} lost revisions` }),
    ),
    Effect.retry({ schedule: Schedule.spaced(READINESS_INTERVAL).pipe(Schedule.upTo({ duration: timeout })) }),
    Effect.tap(() =>
      Effect.sync(() =>
        writeDiagnostic({ program: PROGRAM, line: `readiness: production runs ${release} at ${revision}` }),
      ),
    ),
  );
}

/** The classes whose schema revision is below the one production reported before, none on a first deploy. */
function loweredClasses({ before, readiness }: LoweredClassesInput): ReadonlyArray<string> {
  const now = new Map(readiness.durableObjects.map((object) => [object.objectClass, object.schemaRevision]));

  return Option.match(before, {
    onNone: () => [],
    onSome: ({ durableObjects }) =>
      durableObjects
        .filter((object) => (now.get(object.objectClass) ?? 0) < object.schemaRevision)
        .map((object) => object.objectClass),
  });
}
