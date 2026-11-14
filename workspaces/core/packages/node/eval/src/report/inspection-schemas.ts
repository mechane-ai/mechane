import { Micros, Tokens } from '@mechane/records';
import { Schema } from 'effect';
import {
  CleanupRecord,
  EvalCaseDefinition,
  EvalManifest,
  EvalStageFailure,
  EvalTrial,
  EvidenceRecord,
  GradeSubmission,
  Observation,
  RoleIntent,
  RoleReceipt,
  RoleRecord,
  StructuredGradeRecord,
} from '../application-schemas.ts';
import { CriterionVerdict, EvalScope } from '../constants.ts';
import { EvalId, Grade } from '../schemas.ts';

export const INSPECTION_VERSION = 1;

export const InspectionSource = {
  Records: 'records',
  HistoricalSundial: 'historical_sundial',
  HistoricalMechane: 'historical_mechane',
} as const;

export type InspectionSource = (typeof InspectionSource)[keyof typeof InspectionSource];

/** Whether completion covers the subject and judge or only a saved judge audit. */
export const InspectionScope = EvalScope;

export type InspectionScope = EvalScope;

export const StageStatus = {
  NotStarted: 'not_started',
  Pending: 'pending',
  Completed: 'completed',
  Failed: 'failed',
  Cancelled: 'cancelled',
  Ungradable: 'ungradable',
  Unknown: 'unknown',
} as const;

export type StageStatus = (typeof StageStatus)[keyof typeof StageStatus];

/** Numeric credit and criterion uncertainty have distinct representations. */
export const QualityKind = {
  Numeric: 'numeric',
  Criteria: 'criteria',
  Structured: 'structured',
  Unavailable: 'unavailable',
} as const;

export type QualityKind = (typeof QualityKind)[keyof typeof QualityKind];

export const NumericQuality = Schema.Struct({
  kind: Schema.Literal(QualityKind.Numeric),
  scaleId: Schema.NonEmptyString,
  score: Schema.Number,
});

export type NumericQuality = typeof NumericQuality.Type;

export const CriteriaQuality = Schema.Struct({
  kind: Schema.Literal(QualityKind.Criteria),
  verdict: Schema.Enum(CriterionVerdict),
  criteria: Schema.OptionFromNullOr(Grade.fields.criteria),
});

export type CriteriaQuality = typeof CriteriaQuality.Type;

/** A quality projection keeps numeric credit apart from criterion uncertainty. */
export const GradeQuality = Schema.Union([
  NumericQuality,
  CriteriaQuality,
  Schema.Struct({ kind: Schema.Literal(QualityKind.Structured) }),
  Schema.Struct({ kind: Schema.Literal(QualityKind.Unavailable) }),
]);

export type GradeQuality = typeof GradeQuality.Type;

export const RoleSpend = Schema.Struct({
  knownChargedMicros: Micros,
  isComplete: Schema.Boolean,
  unknownAttempts: Schema.Array(Schema.String),
  knownInputTokens: Tokens,
  knownOutputTokens: Tokens,
  knownCacheReadTokens: Tokens,
  knownCacheWriteTokens: Tokens,
  unknownUsageAttempts: Schema.Array(Schema.String),
});

export type RoleSpend = typeof RoleSpend.Type;

export const TrialStages = Schema.Struct({
  subject: Schema.Enum(StageStatus),
  evidence: Schema.Enum(StageStatus),
  grading: Schema.Enum(StageStatus),
  cleanup: Schema.Enum(StageStatus),
  isComplete: Schema.Boolean,
  issues: Schema.Array(Schema.String),
});

export type TrialStages = typeof TrialStages.Type;

export const TrialInspection = Schema.Struct({
  id: EvalTrial.fields.id,
  caseId: EvalId,
  repeat: Schema.Int,
  stages: TrialStages,
  subjectSpend: RoleSpend,
  judgeSpend: RoleSpend,
  quality: GradeQuality,
  frozenCase: Schema.OptionFromNullOr(EvalCaseDefinition),
  subjectIntent: Schema.OptionFromNullOr(RoleIntent),
  subjectReceipt: Schema.OptionFromNullOr(RoleReceipt),
  subject: Schema.OptionFromNullOr(RoleRecord),
  observations: Schema.Array(Observation),
  evidence: Schema.OptionFromNullOr(EvidenceRecord),
  judgeIntent: Schema.OptionFromNullOr(RoleIntent),
  judgeReceipt: Schema.OptionFromNullOr(RoleReceipt),
  judge: Schema.OptionFromNullOr(RoleRecord),
  submission: Schema.OptionFromNullOr(GradeSubmission),
  grade: Schema.OptionFromNullOr(StructuredGradeRecord),
  cleanup: Schema.Array(CleanupRecord),
  failures: Schema.Array(EvalStageFailure),
  historicalRecord: Schema.OptionFromNullOr(Schema.Json),
});

export type TrialInspection = typeof TrialInspection.Type;

export const EvalCompletion = Schema.Struct({
  isComplete: Schema.Boolean,
  selectedTrials: Schema.Int,
  completedTrials: Schema.Int,
  subjectCompletedTrials: Schema.Int,
  gradedTrials: Schema.Int,
  cleanupCompletedTrials: Schema.Int,
  subjectFailedTrials: Schema.Int,
  judgeFailedTrials: Schema.Int,
  cancelledTrials: Schema.Int,
  ungradableTrials: Schema.Int,
  pendingTrials: Schema.Int,
});

export type EvalCompletion = typeof EvalCompletion.Type;

const NumericSummary = Schema.Struct({
  scaleId: Schema.NonEmptyString,
  gradedTrials: Schema.Int,
  scoreSum: Schema.Number,
  meanScore: Schema.OptionFromNullOr(Schema.Number),
});

export type NumericSummary = typeof NumericSummary.Type;

export const QualitySummary = Schema.Struct({
  numeric: Schema.Array(NumericSummary),
  criteria: Schema.Struct({ gradedTrials: Schema.Int, pass: Schema.Int, fail: Schema.Int, uncertain: Schema.Int }),
  unprojectedTrials: Schema.Int,
});

export type QualitySummary = typeof QualitySummary.Type;

/** Completion, grades, role accounting, and historical evidence retain separate scopes. */
export const EvalInspection = Schema.Struct({
  version: Schema.Literal(INSPECTION_VERSION),
  source: Schema.Enum(InspectionSource),
  scope: Schema.Enum(InspectionScope),
  isResumable: Schema.Boolean,
  suiteId: EvalId,
  /** None for a historical report without a frozen run digest. */
  digest: Schema.OptionFromNullOr(Schema.String),
  /** None when only a historical report exists. */
  manifest: Schema.OptionFromNullOr(EvalManifest),
  completion: EvalCompletion,
  subjectSpend: RoleSpend,
  judgeSpend: RoleSpend,
  quality: QualitySummary,
  trials: Schema.Array(TrialInspection),
  notices: Schema.Array(Schema.String),
  /** None for runs whose stage records establish the frozen definition. */
  historicalDefinition: Schema.OptionFromNullOr(Schema.Json),
});

export type EvalInspection = typeof EvalInspection.Type;
