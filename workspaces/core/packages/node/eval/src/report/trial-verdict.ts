import { TurnStatus } from '@mechane/protocol';
import { Option } from 'effect';
import { CriterionVerdict, GraderStatus, TrialVerdict } from '../constants.ts';
import type { Grade } from '../schemas.ts';
import type { GradeRecord, TurnRecord } from '../store/schemas.ts';

/** A trial's saved records. */
type TrialRecords = {
  /** None while the trial has not saved its subject's turn. */
  readonly subject: Option.Option<TurnRecord>;
  /** None while the trial has not saved its grader's turn. */
  readonly grade: Option.Option<GradeRecord>;
};

type TrialVerdictInput = { readonly records: TrialRecords };

type CriteriaInput = { readonly criteria: Grade['criteria'] };

/**
 * A trial's verdict from its saved records alone: unavailable for a role's turn never saved, and run_failed for a turn
 * that ended unanswered. A grader's reply that was no grade is no_grade, and any other is its grade's verdict.
 */
export function trialVerdict({ records }: TrialVerdictInput): TrialVerdict {
  const { subject, grade } = records;

  if (Option.isNone(subject)) {
    return TrialVerdict.Unavailable;
  }

  if (subject.value.outcome.status === TurnStatus.Unanswered) {
    return TrialVerdict.RunFailed;
  }

  if (Option.isNone(grade)) {
    return TrialVerdict.Unavailable;
  }

  const { outcome } = grade.value;

  switch (outcome.status) {
    case GraderStatus.Unanswered:
      return TrialVerdict.RunFailed;
    case GraderStatus.NoGrade:
      return TrialVerdict.NoGrade;
    case GraderStatus.Graded:
      return gradeVerdict({ criteria: outcome.grade.criteria });
  }
}

/** A grade's verdict, the worst of its criteria's: fail before uncertain before pass. */
function gradeVerdict({ criteria }: CriteriaInput): TrialVerdict {
  const verdicts = new Set(criteria.map(({ verdict }) => verdict));

  if (verdicts.has(CriterionVerdict.Fail)) {
    return TrialVerdict.Fail;
  }

  if (verdicts.has(CriterionVerdict.Uncertain)) {
    return TrialVerdict.Uncertain;
  }

  return TrialVerdict.Pass;
}
