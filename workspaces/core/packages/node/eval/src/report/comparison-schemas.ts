import { Schema } from 'effect';
import { EvalTrial } from '../application-schemas.ts';
import { EvalId } from '../schemas.ts';
import { EvalCompletion, GradeQuality, QualitySummary } from './inspection-schemas.ts';

export const COMPARISON_VERSION = 1;

/** Uncertain criterion transitions remain changes rather than measured improvements or regressions. */
export const GradeChange = {
  Regressed: 'regressed',
  Improved: 'improved',
  Unchanged: 'unchanged',
  Changed: 'changed',
  Unavailable: 'unavailable',
} as const;

export type GradeChange = (typeof GradeChange)[keyof typeof GradeChange];

/** One suite judgment's change, with a numeric delta only when its scale supports one. */
export const GradeDifference = Schema.Struct({
  change: Schema.Enum(GradeChange),
  /** None when the grades do not share a comparable numeric scale. */
  scoreDelta: Schema.OptionFromNullOr(Schema.Number),
  issues: Schema.Array(Schema.String),
});

export type GradeDifference = typeof GradeDifference.Type;

const ExperimentDifference = Schema.Struct({ field: Schema.String, baseline: Schema.String, candidate: Schema.String });

export type ExperimentDifference = typeof ExperimentDifference.Type;

const TrialComparison = Schema.Struct({
  caseId: EvalId,
  repeat: Schema.Int,
  baselineTrialId: EvalTrial.fields.id,
  candidateTrialId: EvalTrial.fields.id,
  isBaselineComplete: Schema.Boolean,
  isCandidateComplete: Schema.Boolean,
  baselineQuality: GradeQuality,
  candidateQuality: GradeQuality,
  baselineToolErrors: Schema.Int,
  candidateToolErrors: Schema.Int,
  grade: GradeDifference,
});

export type TrialComparison = typeof TrialComparison.Type;

/** Grade deltas are derived only when both runs have compatible measurement semantics. */
export const EvalComparison = Schema.Struct({
  version: Schema.Literal(COMPARISON_VERSION),
  isComparable: Schema.Boolean,
  isComplete: Schema.Boolean,
  hasRegression: Schema.Boolean,
  subjectComponentKeys: Schema.Array(Schema.String),
  incompatibilities: Schema.Array(Schema.String),
  experimentDifferences: Schema.Array(ExperimentDifference),
  baselineCompletion: EvalCompletion,
  candidateCompletion: EvalCompletion,
  trials: Schema.Array(TrialComparison),
  baselineQuality: QualitySummary,
  candidateQuality: QualitySummary,
  notices: Schema.Array(Schema.String),
});

export type EvalComparison = typeof EvalComparison.Type;
