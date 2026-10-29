import { jsonFileText, replaceFile } from '@mechane/program';
import { Effect, Option } from 'effect';
import { join } from 'node:path';
import { EvalFileFailed } from '../errors.ts';
import { Intent, OutFolderLock } from '../schemas.ts';
import type { EvalStore } from '../types.ts';
import { RECORD_MODE } from './constants.ts';
import { onceFile } from './once-file.ts';
import { GradeRecord, Plan, Report, TurnRecord } from './schemas.ts';

type SaveReportInput = { readonly path: string; readonly report: Report };

/**
 * The out folder's files beside its trials' folders: the lock of the run that writes it, the plan a run follows, and
 * the report it derives.
 */
const OutFile = { Lock: 'lock.json', Plan: 'plan.json', Report: 'report.json' } as const;

/** The folder of the out folder that holds one folder for each trial, named by the trial's id. */
const TRIALS_FOLDER = 'trials';

/**
 * A trial's files: each role's intent, saved before its inbox item is sent, and its turn's record, saved once the turn
 * ends.
 */
const TrialFile = {
  SubjectIntent: 'subject-intent.json',
  Subject: 'subject.json',
  GraderIntent: 'grader-intent.json',
  Grade: 'grade.json',
} as const;

type OutFolderInput = { readonly outFolder: string };

/** The records of the out folder, the one store of an eval run's files. */
export function evalStore({ outFolder }: OutFolderInput): EvalStore {
  const reportPath = join(outFolder, OutFile.Report);

  const trial: EvalStore['trial'] = ({ trialId }) => {
    const folder = join(outFolder, TRIALS_FOLDER, trialId);

    return {
      subjectIntent: onceFile({ path: join(folder, TrialFile.SubjectIntent), schema: Intent }),
      subject: onceFile({ path: join(folder, TrialFile.Subject), schema: TurnRecord }),
      graderIntent: onceFile({ path: join(folder, TrialFile.GraderIntent), schema: Intent }),
      grade: onceFile({ path: join(folder, TrialFile.Grade), schema: GradeRecord }),
    };
  };

  return {
    lock: onceFile({ path: join(outFolder, OutFile.Lock), schema: OutFolderLock }),
    plan: onceFile({ path: join(outFolder, OutFile.Plan), schema: Plan }),
    trial,
    saveReport: ({ report }) => saveReport({ path: reportPath, report }),
  };
}

/** Replaces the report at once, so a reader never sees a partial one. */
const saveReport = Effect.fn('saveReport')(function* ({
  path,
  report,
}: SaveReportInput): Effect.fn.Return<void, EvalFileFailed> {
  yield* replaceFile({
    path,
    contents: jsonFileText({ schema: Report, value: report }),
    mode: RECORD_MODE,
    accept: Option.none(),
  }).pipe(
    Effect.mapError(({ step, path: failedPath, reason }) => new EvalFileFailed({ step, path: failedPath, reason })),
  );
});
