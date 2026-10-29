import { TurnStatus } from '@mechane/protocol';
import { Result, Schema } from 'effect';
import { GraderStatus } from '../constants.ts';
import { Grade } from '../schemas.ts';
import type { Case } from '../schemas.ts';
import type { GraderOutcome, TurnOutcome } from '../store/schemas.ts';

type GraderOutcomeInput = { readonly outcome: TurnOutcome; readonly expectations: Case['expectations'] };

/** A grader's reply as it must be written: one JSON grade. */
const GradeReply = Schema.fromJsonString(Grade);

type GradeReply = typeof GradeReply.Type;

/** A grader's reply that decodes as a grade, which grades its case only with the case's expectations as criteria. */
type CaseGradeInput = { readonly reply: string; readonly grade: Grade; readonly expectations: Case['expectations'] };

/**
 * How a grader's turn graded its case: an unanswered turn stays unanswered. A reply is a grade only when it decodes as
 * one whose criteria are the case's expectations, each once; any other reply is no grade, never a score.
 */
export function graderOutcome({ outcome, expectations }: GraderOutcomeInput): GraderOutcome {
  if (outcome.status === TurnStatus.Unanswered) {
    return outcome;
  }

  const { reply } = outcome;

  return Result.match(Schema.decodeUnknownResult(GradeReply)(reply), {
    onFailure: (error) => ({ status: GraderStatus.NoGrade, reply, issue: error.message }),
    onSuccess: (grade) => caseGrade({ reply, grade, expectations }),
  });
}

/** A decoded grade, which grades the case only when its criteria's ids are the expectations', each once. */
function caseGrade({ reply, grade, expectations }: CaseGradeInput): GraderOutcome {
  const graded = grade.criteria.map(({ id }) => id).toSorted();
  const expected = expectations.map(({ id }) => id).toSorted();

  if (graded.join(' ') !== expected.join(' ')) {
    const issue = `its criteria are ${graded.join(', ')}, where the case's expectations are ${expected.join(', ')}`;

    return { status: GraderStatus.NoGrade, reply, issue };
  }

  return { status: GraderStatus.Graded, reply, grade };
}
