import type Anthropic from '@anthropic-ai/sdk';
import type { OperationCall } from '@mechane/client';
import type { Effect, Option, Schema } from 'effect';
import type {
  CleanupRecord,
  EvalBounds,
  EvalCallId,
  EvalManifest,
  EvalStageFailure,
  EvalSuiteDefinition,
  EvalToolDefinition,
  EvalToolResult,
  EvalTrial,
  EvalTrialId,
  EvidenceRecord,
  GradeSchemaDefinition,
  GradeSubmission,
  ManagedInputAttempt,
  Observation,
  RoleIntent,
  RoleReceipt,
  RoleRecord,
  RoleSettings,
  StructuredGradeRecord,
} from './application-schemas.ts';
import type { EvalRole, EvalScope, EvalTargetKind } from './constants.ts';
import type { EvalAdapterFailed } from './errors.ts';
import type { EvalRunFailure, OnceFile, WorkspaceAccess, WriteProgress } from './types.ts';

/** Evidence, rubrics, and application tool payloads stay within serializable JSON. */
export type Json = Schema.Json;

/** The runner uses ordinary authenticated operations for every role lifecycle. */
export type EvalOperation = 'readiness' | 'showAllowance';

/** A target supplies one selected runtime and its explicit workspace credential. */
export type EvalTarget = {
  readonly call: OperationCall<EvalOperation>;
  readonly access: WorkspaceAccess;
  readonly kind: EvalTargetKind;
  readonly origin: URL;
  readonly artifactIdentity: string;
  readonly managed: Anthropic;
};

/** A decoder validates the submitted value without access to other trial state. */
export type DecodeGradeInput = { readonly value: Json };

/** The decoder and the model-visible submission schema describe the same grade. */
export type EvalGradeSchema = {
  readonly definition: GradeSchemaDefinition;
  readonly decode: (input: DecodeGradeInput) => Effect.Effect<Json, EvalAdapterFailed>;
};

/** The public custom-tool event ID identifies a fixture invocation through recovery. */
export type ExecuteToolInput = { readonly name: string; readonly arguments: Json; readonly callId: EvalCallId };

/** Suites own fixture behavior. The runner records every result before returning it. */
export type EvalEnvironment = {
  readonly execute: (input: ExecuteToolInput) => Effect.Effect<EvalToolResult, EvalAdapterFailed>;
  readonly release: Effect.Effect<void, EvalAdapterFailed>;
};

/** Fixtures receive the visible input and their own recorded history, never private rubrics. */
export type OpenEnvironmentInput = { readonly visible: Json; readonly observations: ReadonlyArray<Observation> };
/** A completed role result determines whether captured evidence is usable. */
export type CollectEvidenceInput = OpenEnvironmentInput & { readonly subject: RoleRecord };
/** The runner supplies the evidence digest and observation time after collection. */
export type CollectedEvidence = Omit<EvidenceRecord, 'digest' | 'createdAt'>;
/** Product validation can resolve references against the exact frozen evidence. */
export type ValidateGradeInput = { readonly value: Json; readonly evidence: EvidenceRecord; readonly rubric: Json };
type ValidateGrade = (input: ValidateGradeInput) => Effect.Effect<void, EvalAdapterFailed>;

/** Public definitions use encoded JSON configuration; callbacks receive only their declared inputs. */
export type EvalSuite = {
  readonly definition: typeof EvalSuiteDefinition.Encoded;
  readonly gradeSchema: EvalGradeSchema;
  readonly openEnvironment: (input: OpenEnvironmentInput) => Effect.Effect<EvalEnvironment, EvalAdapterFailed>;
  readonly collectEvidence: (input: CollectEvidenceInput) => Effect.Effect<CollectedEvidence, EvalAdapterFailed>;
  /** None when decoding the declared grade schema is sufficient. */
  readonly validateGrade: Option.Option<ValidateGrade>;
};

/** Execution resolves the public definition once into canonical units and identities. */
export type ResolvedEvalSuite = Omit<EvalSuite, 'definition'> & { readonly definition: EvalSuiteDefinition };

type SaveObservationInput = { readonly observation: Observation };
type SaveCleanupInput = { readonly cleanup: CleanupRecord };
type SaveFailureInput = { readonly failure: EvalStageFailure };

/** Write-once stage files preserve completed work independently of derived reports. */
export type ApplicationTrialFiles = {
  readonly folder: string;
  readonly subjectIntent: OnceFile<RoleIntent>;
  readonly subjectReceipt: OnceFile<RoleReceipt>;
  readonly subjectInputAttempt: OnceFile<ManagedInputAttempt>;
  readonly subject: OnceFile<RoleRecord>;
  readonly evidence: OnceFile<EvidenceRecord>;
  readonly judgeIntent: OnceFile<RoleIntent>;
  readonly judgeReceipt: OnceFile<RoleReceipt>;
  readonly judgeInputAttempt: OnceFile<ManagedInputAttempt>;
  readonly judge: OnceFile<RoleRecord>;
  readonly submission: OnceFile<GradeSubmission>;
  readonly grade: OnceFile<StructuredGradeRecord>;
  readonly readObservations: () => Effect.Effect<ReadonlyArray<Observation>, EvalRunFailure>;
  readonly saveObservation: (input: SaveObservationInput) => Effect.Effect<void, EvalRunFailure>;
  readonly readJudgeObservations: () => Effect.Effect<ReadonlyArray<Observation>, EvalRunFailure>;
  readonly saveJudgeObservation: (input: SaveObservationInput) => Effect.Effect<void, EvalRunFailure>;
  readonly readCleanup: () => Effect.Effect<ReadonlyArray<CleanupRecord>, EvalRunFailure>;
  readonly saveCleanup: (input: SaveCleanupInput) => Effect.Effect<void, EvalRunFailure>;
  readonly readFailures: () => Effect.Effect<ReadonlyArray<EvalStageFailure>, EvalRunFailure>;
  readonly saveFailure: (input: SaveFailureInput) => Effect.Effect<void, EvalRunFailure>;
};

/** The fixture can read and append only its trial's observations. */
export type ObservationJournal = Pick<ApplicationTrialFiles, 'readObservations' | 'saveObservation'>;

/** Subjects and judges share the same frozen bounds and trial-owned stage files. */
export type RoleContext = {
  readonly target: EvalTarget;
  readonly bounds: EvalBounds;
  readonly trialId: EvalTrialId;
  readonly files: ApplicationTrialFiles;
  readonly writeProgress: WriteProgress;
};

/** Explicit tool and environment selections prevent accidental capability inheritance. */
export type RunRoleInput = {
  readonly context: RoleContext;
  readonly role: EvalRole;
  readonly settings: RoleSettings;
  readonly text: string;
  readonly tools: ReadonlyArray<EvalToolDefinition>;
  /** None for a role that receives no custom tools. */
  readonly environment: Option.Option<EvalEnvironment>;
};

/** Grading receives saved evidence and its private rubric without the subject's environment. */
export type GradeEvidenceInput = {
  readonly suite: ResolvedEvalSuite;
  readonly evidence: EvidenceRecord;
  readonly rubric: Json;
  readonly context: RoleContext;
};

/** Each optional stage records whether work happened instead of inventing a missing result. */
export type EvalTrialSnapshot = {
  readonly trial: EvalTrial;
  /** None before the subject's creation intent was saved. */
  readonly subjectIntent: Option.Option<RoleIntent>;
  /** None until subject creation was accepted or reconciled. */
  readonly subjectReceipt: Option.Option<RoleReceipt>;
  /** None until the subject's terminal result was recorded. */
  readonly subject: Option.Option<RoleRecord>;
  readonly observations: ReadonlyArray<Observation>;
  /** None until the adapter's frozen evidence was recorded. */
  readonly evidence: Option.Option<EvidenceRecord>;
  /** None when grading has not started or evidence cannot be graded. */
  readonly judgeIntent: Option.Option<RoleIntent>;
  /** None until judge creation was accepted or reconciled. */
  readonly judgeReceipt: Option.Option<RoleReceipt>;
  /** None until the judge's terminal result was recorded. */
  readonly judge: Option.Option<RoleRecord>;
  /** None when the judge has not submitted an accepted structured grade. */
  readonly submission: Option.Option<GradeSubmission>;
  /** None before the grading stage recorded its outcome. */
  readonly grade: Option.Option<StructuredGradeRecord>;
  readonly cleanup: ReadonlyArray<CleanupRecord>;
  readonly failures: ReadonlyArray<EvalStageFailure>;
};

/** Inspection preserves whether records came from execution or a judge-only audit. */
export type SavedEval = {
  readonly manifest: EvalManifest;
  readonly trials: ReadonlyArray<EvalTrialSnapshot>;
  readonly scope: EvalScope;
  readonly isAudit: boolean;
};

/** A new run selects its suite, runtime, output folder, and progress channel explicitly. */
export type RunApplicationEvalInput = {
  readonly suite: EvalSuite;
  readonly target: EvalTarget;
  readonly outFolder: string;
  readonly writeProgress: WriteProgress;
};
