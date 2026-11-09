import { Option } from 'effect';
import { CriterionVerdict, GraderStatus, RoleStatus, TrialVerdict } from '../constants.ts';
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

/** Saved execution outcomes take precedence over grading, so partial or unpublished text cannot become a score. */
export function trialVerdict({ records }: TrialVerdictInput): TrialVerdict {
  const { subject, grade } = records;

  if (Option.isNone(subject)) {
    return TrialVerdict.Unavailable;
  }

  if (subject.value.outcome.status === RoleStatus.Failed) {
    return TrialVerdict.RunFailed;
  }

  if (subject.value.outcome.status === RoleStatus.Stopped) {
    return TrialVerdict.Stopped;
  }

  if (subject.value.outcome.status === RoleStatus.NoReply) {
    return TrialVerdict.NoReply;
  }

  if (Option.isNone(grade)) {
    return TrialVerdict.Unavailable;
  }

  const { outcome } = grade.value;

  switch (outcome.status) {
    case GraderStatus.Failed:
      return TrialVerdict.RunFailed;
    case GraderStatus.Stopped:
      return TrialVerdict.Stopped;
    case GraderStatus.NoReply:
      return TrialVerdict.NoReply;
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
