import { Effect } from 'effect';
import type { ApplicationTrialFiles, EvalTrialSnapshot } from '../application-types.ts';
import type { EvalRunFailure } from '../types.ts';

type ReadJudgeRecordsInput = { readonly files: ApplicationTrialFiles };

type JudgeRecords = Pick<
  EvalTrialSnapshot,
  'judgeIntent' | 'judgeReceipt' | 'judge' | 'submission' | 'grade' | 'cleanup' | 'failures'
>;

/** Audits and ordinary runs inspect the same authoritative judge stages. */
export const readJudgeRecords = Effect.fn('readJudgeRecords')(function* ({
  files,
}: ReadJudgeRecordsInput): Effect.fn.Return<JudgeRecords, EvalRunFailure> {
  const judgeIntent = yield* files.judgeIntent.read();
  const judgeReceipt = yield* files.judgeReceipt.read();
  const judge = yield* files.judge.read();
  const submission = yield* files.submission.read();
  const grade = yield* files.grade.read();
  const cleanup = yield* files.readCleanup();
  const failures = yield* files.readFailures();

  return { judgeIntent, judgeReceipt, judge, submission, grade, cleanup, failures };
});
