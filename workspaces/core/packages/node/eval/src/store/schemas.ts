import { TracedDispatch, TurnStatus, UnansweredReason } from '@mechane/protocol';
import { memberOrUnknown, RandomId, RecordId, SHA256_PATTERN, TurnId, wireStruct } from '@mechane/records';
import { Record, Schema } from 'effect';
import { GraderStatus, REPORT_VERSION, TRIAL_ID_PATTERN, TrialVerdict } from '../constants.ts';
import { EvalId, Grade, PlanBasis } from '../schemas.ts';

/** The fields of a trial: its id, which its plan's digest, its case's id and its repeat derive, and those parts. */
const TRIAL_FIELDS = {
  id: Schema.String.check(Schema.isPattern(TRIAL_ID_PATTERN)),
  caseId: EvalId,
  repeat: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
} as const;

/** One run of one case, on its own fresh mechs. */
export const Trial = wireStruct({ fields: TRIAL_FIELDS });

export type Trial = typeof Trial.Type;

/** The SHA-256 of a plan's basis, as lowercase hex. */
const Digest = Schema.String.check(Schema.isPattern(SHA256_PATTERN));

/** A plan: its basis, the SHA-256 of the basis's canonical encoding, and each trial it runs, in order. */
export const Plan = Schema.Struct({ basis: PlanBasis, digest: Digest, trials: Schema.Array(Trial) });

export type Plan = typeof Plan.Type;

/** The fields of a role's saved turn: its mech, its inbox item, its turn, and each dispatch the turn made. */
const TURN_RECORD_FIELDS = {
  mechId: RecordId,
  inboxItemId: RandomId,
  turnId: TurnId,
  dispatches: Schema.Array(TracedDispatch),
} as const;

const Unanswered = Schema.Struct({
  status: Schema.Literal(TurnStatus.Unanswered),
  reason: memberOrUnknown({ set: UnansweredReason }),
});

/** How a role's turn ended: with its reply, or without one, for a reason. */
export const TurnOutcome = Schema.Union([
  Schema.Struct({ status: Schema.Literal(TurnStatus.Answered), reply: Schema.String }),
  Unanswered,
]);

export type TurnOutcome = typeof TurnOutcome.Type;

/** A role's turn and how it ended, which a trial's `subject.json` holds for its subject. */
export const TurnRecord = wireStruct({ fields: { ...TURN_RECORD_FIELDS, outcome: TurnOutcome } });

export type TurnRecord = typeof TurnRecord.Type;

/**
 * How a grader's turn ended: with a reply that decodes as the case's grade, with a reply that does not and why, or
 * without a reply. A text answer is never a grade.
 */
export const GraderOutcome = Schema.Union([
  Schema.Struct({ status: Schema.Literal(GraderStatus.Graded), reply: Schema.String, grade: Grade }),
  Schema.Struct({ status: Schema.Literal(GraderStatus.NoGrade), reply: Schema.String, issue: Schema.String }),
  Unanswered,
]);

export type GraderOutcome = typeof GraderOutcome.Type;

/** A trial's `grade.json`: the grader's turn and how it ended. */
export const GradeRecord = wireStruct({ fields: { ...TURN_RECORD_FIELDS, outcome: GraderOutcome } });

export type GradeRecord = typeof GradeRecord.Type;

/** What the saved turns' dispatches were charged: the subjects' apart from the graders', as grading is no measure. */
const CHARGED_FIELDS = { subjectChargedMicros: Schema.Int, graderChargedMicros: Schema.Int } as const;

/** One trial as the report derives it from its saved records, with what each role's dispatches were charged. */
const TrialReport = wireStruct({ fields: { ...TRIAL_FIELDS, verdict: Schema.Enum(TrialVerdict), ...CHARGED_FIELDS } });

/**
 * A run's `report.json`, derived from the out folder's records alone: each trial's verdict, the count of each verdict,
 * and what the saved turns were charged. A role's turn never saved charged an unknown amount, as `unavailable` says.
 */
export const Report = wireStruct({
  fields: {
    version: Schema.Literal(REPORT_VERSION),
    suiteId: EvalId,
    digest: Digest,
    trials: Schema.Array(TrialReport),
    totals: wireStruct({ fields: Record.map(TrialVerdict, () => Schema.Int) }),
    ...CHARGED_FIELDS,
  },
});

export type Report = typeof Report.Type;
