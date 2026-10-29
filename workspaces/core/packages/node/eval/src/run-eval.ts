import type { OperationCall } from '@mechane/client';
import { Effect, Record } from 'effect';
import type { Scope } from 'effect';
import { caseTrials } from './case-trials.ts';
import { CriterionVerdict, EvalOutcome } from './constants.ts';
import type { TrialVerdict } from './constants.ts';
import { failOnInterrupt } from './fail-on-interrupt.ts';
import { planRun } from './plan-run.ts';
import { evalReport } from './report/eval-report.ts';
import { reportLines } from './report/report-lines.ts';
import { evalStore } from './store/eval-store.ts';
import { holdOutFolder } from './store/hold-out-folder.ts';
import type { Report } from './store/schemas.ts';
import { runTrial } from './trial/run-trial.ts';
import type { EvalRunFailure, EvalStore, WorkspaceAccess, WriteProgress } from './types.ts';

/** How a run ended, and its report: the lines a person reads, and the report a program reads. */
type EvalRun = { readonly outcome: EvalOutcome; readonly lines: ReadonlyArray<string>; readonly report: Report };

/** The operations a run calls: the deployment's readiness and allowance, and its trials' mechs and turns. */
type EvalOperation = 'readiness' | 'showAllowance' | 'createMech' | 'sendInboxItem' | 'listEvents' | 'showTurn';

/**
 * A suite to run in the caller's workspace, where the run creates its mechs, the out folder of its records, and where
 * it writes its progress.
 */
type RunEvalInput = {
  readonly call: OperationCall<EvalOperation>;
  readonly access: WorkspaceAccess;
  readonly suiteFile: string;
  readonly outFolder: string;
  readonly writeProgress: WriteProgress;
};

/** A run's input but its out folder, and the out folder's store, which the run holds while it works. */
type EvalWorkInput = Omit<RunEvalInput, 'outFolder'> & { readonly store: EvalStore };

/** The verdicts of a trial that completed whatever its score; any other leaves the run incomplete. */
const COMPLETED_VERDICTS: ReadonlySet<TrialVerdict> = new Set(Record.values(CriterionVerdict));

/**
 * Runs a suite through the deployment, measuring a mech with nothing but `/v1`: it plans the run, runs each trial in
 * order, and reports from the out folder's records alone. Ctrl-C interrupts it once its finalizers ran, which release
 * the out folder's lock, and a rerun with the same out folder resumes.
 */
export const runEval = Effect.fn('runEval')(function* ({
  call,
  access,
  suiteFile,
  outFolder,
  writeProgress,
}: RunEvalInput): Effect.fn.Return<EvalRun, EvalRunFailure> {
  const store = evalStore({ outFolder });

  return yield* failOnInterrupt({ program: evalWork({ call, access, suiteFile, store, writeProgress }), outFolder });
});

/** Holds the out folder, runs each trial of its plan, saves the report, and completes once every trial was graded. */
const evalWork = Effect.fn('evalWork')(function* ({
  call,
  access,
  suiteFile,
  store,
  writeProgress,
}: EvalWorkInput): Effect.fn.Return<EvalRun, EvalRunFailure, Scope.Scope> {
  yield* holdOutFolder({ store });

  const plan = yield* planRun({ call, access, suiteFile, store });
  const { suite } = plan.basis;

  for (const { evalCase, trial } of caseTrials({ cases: suite.cases, trials: plan.trials })) {
    yield* runTrial({ call, access, suite, evalCase, trial, files: store.trial({ trialId: trial.id }), writeProgress });
  }

  const report = yield* evalReport({ plan, store });
  const isCompleted = report.trials.every(({ verdict }) => COMPLETED_VERDICTS.has(verdict));

  const outcome: EvalOutcome = (() => {
    if (isCompleted) {
      return EvalOutcome.Completed;
    }

    return EvalOutcome.Incomplete;
  })();

  yield* store.saveReport({ report });

  return { outcome, lines: reportLines({ report }), report };
}, Effect.scoped);
