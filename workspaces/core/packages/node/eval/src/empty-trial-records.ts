import { Option } from 'effect';
import type { EvalTrialSnapshot } from './application-types.ts';

type EmptyTrialRecords = Omit<EvalTrialSnapshot, 'trial'>;

/** Each projection or audit owns its empty history arrays. */
export function createEmptyTrialRecords(): EmptyTrialRecords {
  return {
    subjectIntent: Option.none(),
    subjectReceipt: Option.none(),
    subject: Option.none(),
    observations: [],
    evidence: Option.none(),
    judgeIntent: Option.none(),
    judgeReceipt: Option.none(),
    judge: Option.none(),
    submission: Option.none(),
    grade: Option.none(),
    cleanup: [],
    failures: [],
  };
}
