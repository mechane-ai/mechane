import { ModelId } from '@mechane/deployment';
import { InboxText, Instructions } from '@mechane/protocol';
import { isWellFormedText, Micros, RandomId, RecordId, wireStruct } from '@mechane/records';
import { Effect, Predicate, Schema } from 'effect';
import {
  CASES_PER_SUITE,
  CriterionVerdict,
  DESCRIPTION_MAX_CHARS,
  EVAL_ID_PATTERN,
  EXPECTATIONS_PER_CASE,
  INPUT_MAX_CHARS,
  PLAN_VERSION,
  REPEATS_PER_CASE,
  SUITE_VERSION,
} from './constants.ts';

/** The out folder's lock: the id of the process whose run writes its records. */
export const OutFolderLock = wireStruct({ fields: { processId: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)) } });

export type OutFolderLock = typeof OutFolderLock.Type;

/** A role's turn about to be sent: the fresh mech and the inbox item's id, recorded before the send. */
export const Intent = wireStruct({ fields: { mechId: RecordId, inboxItemId: RandomId } });

export type Intent = typeof Intent.Type;

/** The id of a suite, a case or an expectation. */
export const EvalId = Schema.String.check(Schema.isPattern(EVAL_ID_PATTERN));

export type EvalId = typeof EvalId.Type;

/** A record that its id names, as a case or an expectation is. */
const Identified = Schema.Struct({ id: EvalId });

/** A list of records whose ids are distinct, so each id names one record. */
const hasDistinctIds = Schema.makeFilter(
  (records: ReadonlyArray<typeof Identified.Type>) => new Set(records.map(({ id }) => id)).size === records.length,
  { expected: 'records with distinct ids' },
);

/** One thing a case's reply should do, which the grader judges and the subject never sees. */
const Expectation = Schema.Struct({
  id: EvalId,
  description: Schema.String.check(isWellFormedText, Schema.isBetweenLength(1, DESCRIPTION_MAX_CHARS)),
});

/** One task for the subject: the input it receives as its inbox item, and the expectations its reply is graded by. */
const Case = Schema.Struct({
  id: EvalId,
  input: InboxText.check(Schema.isMaxLength(INPUT_MAX_CHARS)),
  expectations: Schema.Array(Expectation).check(Schema.isBetweenLength(1, EXPECTATIONS_PER_CASE), hasDistinctIds),
});

/** One task of a suite for the subject, with the expectations its reply is graded by. */
export type Case = typeof Case.Type;

/**
 * A suite file: the subject's settings, the grader's model, how often each case runs, and the cap of each mech a trial
 * creates. The caps let the ledger bound what each of a trial's two turns can spend.
 */
export const Suite = wireStruct({
  fields: {
    version: Schema.Literal(SUITE_VERSION),
    id: EvalId,
    subject: Schema.Struct({
      /** Absent for a subject without instructions of its own. */
      instructions: Schema.optionalKey(Instructions),
      /** Absent for the deployment's first offer. */
      model: Schema.optionalKey(ModelId),
    }),
    grader: Schema.Struct({
      /** Absent for the deployment's first offer. */
      model: Schema.optionalKey(ModelId),
    }),
    /** Absent for a suite whose grader must run on another model than its subject. */
    isSelfGrading: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
    repeats: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: REPEATS_PER_CASE })),
    trialCapMicros: Micros.check(Schema.isGreaterThanOrEqualTo(1)),
    cases: Schema.Array(Case).check(Schema.isBetweenLength(1, CASES_PER_SUITE), hasDistinctIds),
  },
}).check(
  // A model a suite omits is the deployment's first offer, which no read reports, so only two named models differ.
  Schema.makeFilter(
    ({ isSelfGrading, subject, grader }) =>
      isSelfGrading ||
      ([subject.model, grader.model].every(Predicate.isNotUndefined) && subject.model !== grader.model),
    { expected: "a grader on a model the suite names apart from the subject's, unless self_grading is true" },
  ),
);

export type Suite = typeof Suite.Type;

/** What a plan's digest covers: the suite, and the deployment and workspace it runs against. */
export const PlanBasis = wireStruct({
  fields: {
    version: Schema.Literal(PLAN_VERSION),
    suite: Suite,
    release: Schema.String,
    workerRevision: Schema.String,
    workspaceId: RecordId,
  },
});

export type PlanBasis = typeof PlanBasis.Type;

/** A grade: one criterion for each of the case's expectations, under its id, with a verdict and its evidence. */
export const Grade = Schema.Struct({
  summary: Schema.String,
  criteria: Schema.Array(
    Schema.Struct({ id: EvalId, verdict: Schema.Enum(CriterionVerdict), evidence: Schema.String }),
  ).check(Schema.isBetweenLength(1, EXPECTATIONS_PER_CASE)),
});

export type Grade = typeof Grade.Type;
