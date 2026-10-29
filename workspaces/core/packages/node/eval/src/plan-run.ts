import type { OperationCall } from '@mechane/client';
import { Effect, Number, Option } from 'effect';
import { buildPlan } from './build-plan.ts';
import type { EvalFileFailed } from './errors.ts';
import { AllowanceExhausted, PlanChanged } from './errors.ts';
import { readSuite } from './read-suite.ts';
import type { Plan, Trial } from './store/schemas.ts';
import { unsavedTurns } from './trial/unsaved-turns.ts';
import type { EvalRunFailure, EvalStore, WorkspaceAccess } from './types.ts';

type PlanRunInput = {
  readonly call: OperationCall<'readiness' | 'showAllowance'>;
  readonly access: WorkspaceAccess;
  readonly suiteFile: string;
  readonly store: EvalStore;
};

/**
 * Plans the run before it creates any mech. It refuses an out folder whose saved plan differs, or unsaved turns that at
 * their mechs' caps could spend more than the day's allowance has left. Only a plan that may run is saved.
 */
export const planRun = Effect.fn('planRun')(function* ({
  call,
  access,
  suiteFile,
  store,
}: PlanRunInput): Effect.fn.Return<Plan, EvalRunFailure> {
  const { token, workspaceId } = access;
  const suite = yield* readSuite({ path: suiteFile });
  const readiness = yield* call({ name: 'readiness', input: {}, credential: Option.none() });
  const allowance = yield* call({ name: 'showAllowance', input: { workspaceId }, credential: token });
  const plan = buildPlan({ suite, readiness, workspaceId });
  const saved = yield* store.plan.read();

  if (Option.isSome(saved) && saved.value.digest !== plan.digest) {
    const { path } = store.plan;

    return yield* new PlanChanged({ path, savedDigest: saved.value.digest, plannedDigest: plan.digest });
  }

  const unsavedOfTrial: (trial: Trial) => Effect.Effect<number, EvalFileFailed> = (trial) =>
    unsavedTurns({ files: store.trial({ trialId: trial.id }) });

  const unsaved = yield* Effect.forEach(plan.trials, unsavedOfTrial, { concurrency: 1 });
  const neededMicros = Number.sumAll(unsaved) * suite.trialCapMicros;
  const remainingMicros = allowance.dailyAllowanceMicros - allowance.committedMicros;

  if (neededMicros > remainingMicros) {
    return yield* new AllowanceExhausted({ day: allowance.day, neededMicros, remainingMicros });
  }

  if (Option.isNone(saved)) {
    yield* store.plan.create({ record: plan });
  }

  return plan;
});
