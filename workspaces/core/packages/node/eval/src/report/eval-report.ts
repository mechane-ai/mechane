import { Effect, Number, Record } from 'effect';
import { REPORT_VERSION, TrialVerdict } from '../constants.ts';
import type { EvalFileFailed } from '../errors.ts';
import type { Plan, Report, Trial } from '../store/schemas.ts';
import type { EvalStore, TrialFiles } from '../types.ts';
import { savedChargedMicros } from './saved-charged-micros.ts';
import { trialVerdict } from './trial-verdict.ts';

type EvalReportInput = { readonly plan: Plan; readonly store: EvalStore };

type TrialReportInput = { readonly trial: Trial; readonly files: TrialFiles };

/** One trial as the report derives it. */
type TrialReport = Report['trials'][number];

/** The report of a plan, derived from the out folder's records alone, read after the run. */
export const evalReport = Effect.fn('evalReport')(function* ({
  plan,
  store,
}: EvalReportInput): Effect.fn.Return<Report, EvalFileFailed> {
  const reportOfTrial: (trial: Trial) => Effect.Effect<TrialReport, EvalFileFailed> = (trial) =>
    trialReport({ trial, files: store.trial({ trialId: trial.id }) });

  const trials = yield* Effect.forEach(plan.trials, reportOfTrial, { concurrency: 1 });

  const trialsWith: (verdict: TrialVerdict) => number = (verdict) =>
    trials.filter((trial) => trial.verdict === verdict).length;

  const subjectMicros = trials.map((trial) => trial.subjectChargedMicros);
  const graderMicros = trials.map((trial) => trial.graderChargedMicros);

  return {
    version: REPORT_VERSION,
    suiteId: plan.basis.suite.id,
    digest: plan.digest,
    trials,
    totals: Record.map(TrialVerdict, trialsWith),
    subjectChargedMicros: Number.sumAll(subjectMicros),
    graderChargedMicros: Number.sumAll(graderMicros),
  };
});

/** A trial's verdict and what each role's saved turn's dispatches were charged, nothing for a turn never saved. */
const trialReport = Effect.fn('trialReport')(function* ({
  trial,
  files,
}: TrialReportInput): Effect.fn.Return<TrialReport, EvalFileFailed> {
  const subject = yield* files.subject.read();
  const grade = yield* files.grade.read();

  return {
    ...trial,
    verdict: trialVerdict({ records: { subject, grade } }),
    subjectChargedMicros: savedChargedMicros({ record: subject }),
    graderChargedMicros: savedChargedMicros({ record: grade }),
  };
});
