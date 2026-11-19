import { Instructions, NotificationText } from '@mechane/protocol';
import {
  Bytes,
  CreationRequestId,
  Micros,
  renamedWireStruct,
  Sequence,
  UNSIGNED_INTEGER_PATTERN,
  WorkspaceId,
} from '@mechane/records';
import { Duration, Schema } from 'effect';
import {
  CASES_PER_SUITE,
  EvalAuditKind,
  EvalRole,
  EvalTargetKind,
  ObservationProvenance,
  REPEATS_PER_CASE,
  TRIAL_ID_PATTERN,
} from './constants.ts';
import { EvalId } from './schemas.ts';

/** Record codecs own this version; reports remain derived from the saved stages. */
export const EVAL_FORMAT_VERSION = 4;

/** A terminal role result stays distinct from whether its evidence can be graded. */
export const EvalRoleStatus = { Completed: 'completed', Failed: 'failed', Cancelled: 'cancelled' } as const;
/** An unavailable or failed judgment never becomes a poor quality score. */
export const StructuredGradeStatus = { Graded: 'graded', Ungradable: 'ungradable', Failed: 'failed' } as const;

const SchemaIdentity = Schema.Struct({ id: Schema.NonEmptyString, version: Schema.NonEmptyString });
const hasTrialIdPattern = Schema.isPattern(TRIAL_ID_PATTERN);

/** Trial identities are deterministic digests, independent of mutable infrastructure resources. */
export const EvalTrialId = Schema.String.check(hasTrialIdPattern).pipe(Schema.brand('EvalTrialId'));
export type EvalTrialId = typeof EvalTrialId.Type;

/** A caller retains this tool identity through retries and transport replacement. */
export const EvalCallId = Schema.NonEmptyString.pipe(Schema.brand('EvalCallId'));
export type EvalCallId = typeof EvalCallId.Type;

/** Suites freeze the grade schema alongside the decoder that accepts its submissions. */
export const GradeSchemaDefinition = Schema.Struct({ ...SchemaIdentity.fields, jsonSchema: Schema.Json });
export type GradeSchemaDefinition = typeof GradeSchemaDefinition.Type;

/** Model-visible tools have frozen names and native JSON Schemas. */
export const EvalToolDefinition = Schema.Struct({
  name: Schema.NonEmptyString,
  description: Schema.String,
  inputSchema: Schema.Json,
  /** Absent when the tool does not declare a structured response schema. */
  outputSchema: Schema.optionalKey(Schema.Json),
});

export type EvalToolDefinition = typeof EvalToolDefinition.Type;

const isPositiveWholeMillis = Schema.makeFilter(
  (duration: Duration.Duration) => {
    const millis = Duration.toMillis(duration);

    return Duration.isPositive(duration) && Number.isSafeInteger(millis);
  },
  { expected: 'a positive whole-millisecond duration' },
);

const PositiveDuration = Schema.DurationFromMillis.check(isPositiveWholeMillis);

/** Public configuration uses milliseconds; execution uses native durations and measured-value brands. */
export const EvalBounds = renamedWireStruct({
  fields: {
    roleCapMicros: Micros.check(Schema.isGreaterThan(0)),
    roleTimeout: PositiveDuration,
    cleanupTimeout: PositiveDuration,
    maxObservationBytes: Bytes.check(Schema.isGreaterThan(0)),
    maxEvidenceBytes: Bytes.check(Schema.isGreaterThan(0)),
    maxToolRequests: Schema.Int.check(Schema.isGreaterThan(0)),
  },
  renames: {
    roleCapMicros: 'roleCapMicros',
    roleTimeout: 'roleTimeoutMs',
    cleanupTimeout: 'cleanupTimeoutMs',
    maxObservationBytes: 'maxObservationBytes',
    maxEvidenceBytes: 'maxEvidenceBytes',
    maxToolRequests: 'maxToolCalls',
  },
});

export type EvalBounds = typeof EvalBounds.Type;

/** The role's model is frozen before its execution. */
export const RoleSettings = Schema.Struct({
  model: Schema.NonEmptyString,
  /** Absent when the role has no additional instructions. */
  instructions: Schema.optionalKey(Instructions),
});

export type RoleSettings = typeof RoleSettings.Type;

/** The runner keeps the rubric separate from subject input. */
export const EvalCaseDefinition = Schema.Struct({
  id: EvalId,
  input: NotificationText,
  visible: Schema.Json,
  rubric: Schema.Json,
});

export type EvalCaseDefinition = typeof EvalCaseDefinition.Type;

/** A suite freezes inputs, capabilities, grading behavior, and comparison provenance before execution. */
export const EvalSuiteDefinition = Schema.Struct({
  id: EvalId,
  version: Schema.NonEmptyString,
  adapter: Schema.Struct({ ...SchemaIdentity.fields, fingerprint: Schema.NonEmptyString }),
  subject: RoleSettings,
  judge: Schema.Struct({
    ...RoleSettings.fields,
    instructions: Instructions,
    isSelfGrading: Schema.Boolean,
    gradeSchema: GradeSchemaDefinition,
  }),
  repeats: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: REPEATS_PER_CASE })),
  bounds: EvalBounds,
  tools: Schema.Array(EvalToolDefinition),
  cases: Schema.Array(EvalCaseDefinition).check(Schema.isBetweenLength(1, CASES_PER_SUITE)),
  components: Schema.Json,
});

export type EvalSuiteDefinition = typeof EvalSuiteDefinition.Type;

/** Resume requires the same selected runtime and artifact identity. */
export const EvalTargetIdentity = Schema.Struct({
  kind: Schema.Enum(EvalTargetKind),
  origin: Schema.NonEmptyString,
  workspaceId: WorkspaceId,
  release: Schema.String,
  runtimeRevision: Schema.String,
  artifactIdentity: Schema.NonEmptyString,
});

export type EvalTargetIdentity = typeof EvalTargetIdentity.Type;

/** Each repeat names its own deterministic trial and fresh role resources. */
export const EvalTrial = Schema.Struct({ id: EvalTrialId, caseId: EvalId, repeat: Schema.Int });

export type EvalTrial = typeof EvalTrial.Type;

/** Authoritative run inputs are immutable; inspection reconstructs its projection from stage records. */
export const EvalManifest = Schema.Struct({
  version: Schema.Literal(EVAL_FORMAT_VERSION),
  digest: Schema.NonEmptyString,
  startedAt: Schema.DateTimeUtcFromString,
  definition: EvalSuiteDefinition,
  target: EvalTargetIdentity,
  trials: Schema.Array(EvalTrial),
});

export type EvalManifest = typeof EvalManifest.Type;

/** An audit preserves its source digest without replacing original evidence or grades. */
export const EvalAuditManifest = Schema.Struct({
  kind: Schema.Enum(EvalAuditKind),
  id: EvalId,
  /** None for calibration examples that have no source run. */
  sourceDigest: Schema.OptionFromNullOr(Schema.String),
  manifest: EvalManifest,
});

export type EvalAuditManifest = typeof EvalAuditManifest.Type;

/** A saved role intent owns its agent, environment, session, and one input. */
export const RoleIntent = Schema.Struct({
  creationRequestId: CreationRequestId,
  role: Schema.Enum(EvalRole),
  name: Schema.NonEmptyString,
  settings: RoleSettings,
  text: Schema.String,
  deadlineAt: Schema.DateTimeUtcFromString,
  capMicros: Micros,
});

export type RoleIntent = typeof RoleIntent.Type;

/** The receipt binds the isolated session to its agent, environment and saved input. */
export const RoleReceipt = Schema.Struct({
  creationRequestId: CreationRequestId,
  agentId: Schema.NonEmptyString,
  environmentId: Schema.NonEmptyString,
  sessionId: Schema.NonEmptyString,
  resolvedModel: Schema.NonEmptyString,
  createdAt: Schema.DateTimeUtcFromString,
  /** None when the provider did not disclose a revision. */
  providerRevision: Schema.OptionFromNullOr(Schema.String),
});

export type RoleReceipt = typeof RoleReceipt.Type;

export const ManagedInputAttempt = Schema.Struct({
  sessionId: Schema.NonEmptyString,
  creationRequestId: CreationRequestId,
});

export type ManagedInputAttempt = typeof ManagedInputAttempt.Type;

const nonnegative = Schema.isGreaterThanOrEqualTo(0);
const TokenCount = Schema.Int.check(nonnegative);
const decimalInteger = Schema.isPattern(UNSIGNED_INTEGER_PATTERN);
export const MinorUnits = Schema.String.check(decimalInteger);

const SessionUsage = Schema.Struct({
  inputTokens: Schema.optionalKey(TokenCount),
  outputTokens: Schema.optionalKey(TokenCount),
  cacheReadInputTokens: Schema.optionalKey(TokenCount),
  cacheCreation1hInputTokens: Schema.optionalKey(TokenCount),
  cacheCreation5mInputTokens: Schema.optionalKey(TokenCount),
  listCostUsdCents: Schema.optionalKey(MinorUnits),
});

/** Role completion records execution, evidence coverage, and observed usage independently of quality. */
export const RoleRecord = Schema.Struct({
  status: Schema.Enum(EvalRoleStatus),
  agentId: Schema.NonEmptyString,
  sessionId: Schema.NonEmptyString,
  eventIds: Schema.Array(Schema.NonEmptyString),
  /** Absent when the role did not publish a diagnostic reply. */
  reply: Schema.optionalKey(Schema.String),
  /** Absent when execution ended without a recorded issue. */
  issue: Schema.optionalKey(Schema.String),
  /** None when the role selected the deployment's default offer. */
  requestedModel: Schema.OptionFromNullOr(Schema.String),
  resolvedModel: Schema.String,
  /** None when the provider did not disclose a revision. */
  providerRevision: Schema.OptionFromNullOr(Schema.String),
  /** Absent when no cumulative session accounting was recorded. */
  usage: Schema.optionalKey(SessionUsage),
  toolCalls: Schema.Array(Schema.Json),
  isEvidenceComplete: Schema.Boolean,
  unknowns: Schema.Array(Schema.String),
  endedAt: Schema.DateTimeUtcFromString,
});

export type RoleRecord = typeof RoleRecord.Type;

/** Tool rejection is an observed application outcome, distinct from transport failure. */
export const EvalToolResult = Schema.Struct({ output: Schema.Json, isError: Schema.Boolean });
export type EvalToolResult = typeof EvalToolResult.Type;

/** A request and its result are persisted before the caller receives a receipt. */
export const Observation = Schema.Struct({
  trialId: EvalTrialId,
  sequence: Sequence.check(Schema.isGreaterThan(0)),
  callId: EvalCallId,
  requestDigest: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  arguments: Schema.Json,
  result: EvalToolResult,
  observedAt: Schema.DateTimeUtcFromString,
  provenance: Schema.Literal(ObservationProvenance.CustomTool),
});

export type Observation = typeof Observation.Type;

/** Only the adapter's explicit evidence allowlist enters the judge's context. */
export const EvidenceRecord = Schema.Struct({
  schema: SchemaIdentity,
  digest: Schema.NonEmptyString,
  value: Schema.Json,
  scope: Schema.Array(Schema.String),
  isComplete: Schema.Boolean,
  /** Absent when the required evidence is complete. */
  issue: Schema.optionalKey(Schema.String),
  createdAt: Schema.DateTimeUtcFromString,
});

export type EvidenceRecord = typeof EvidenceRecord.Type;

/** The first accepted structured submission remains authoritative through retries. */
export const GradeSubmission = Schema.Struct({
  schema: GradeSchemaDefinition,
  evidenceDigest: Schema.NonEmptyString,
  value: Schema.Json,
  digest: Schema.NonEmptyString,
  submittedAt: Schema.DateTimeUtcFromString,
});

export type GradeSubmission = typeof GradeSubmission.Type;

/** Grade outcomes preserve missing judgments and judge execution failures separately from scores. */
export const StructuredGradeRecord = Schema.Struct({
  status: Schema.Enum(StructuredGradeStatus),
  schema: GradeSchemaDefinition,
  evidenceDigest: Schema.NonEmptyString,
  /** Absent when no structured grade was accepted. */
  value: Schema.optionalKey(Schema.Json),
  /** Absent when grading completed without an issue. */
  issue: Schema.optionalKey(Schema.String),
  /** Absent when incomplete evidence prevented judge execution. */
  judge: Schema.optionalKey(RoleRecord),
  createdAt: Schema.DateTimeUtcFromString,
});

export type StructuredGradeRecord = typeof StructuredGradeRecord.Type;

/** Cleanup attempts append resource identities and unresolved failures without changing grades. */
export const CleanupRecord = Schema.Struct({
  attempt: Schema.Int,
  completedAt: Schema.DateTimeUtcFromString,
  isComplete: Schema.Boolean,
  resources: Schema.Array(Schema.String),
  steps: Schema.Array(Schema.String),
  errors: Schema.Array(Schema.String),
});

export type CleanupRecord = typeof CleanupRecord.Type;

/** Infrastructure and adapter failures remain inspectable when a stage cannot produce its normal record. */
export const EvalStageFailure = Schema.Struct({
  sequence: Sequence,
  stage: Schema.String,
  tag: Schema.String,
  reason: Schema.String,
  observedAt: Schema.DateTimeUtcFromString,
});

export type EvalStageFailure = typeof EvalStageFailure.Type;
