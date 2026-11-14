/** SDK callers supply authenticated workspaces and receive typed failures and progress. @public */
export type { EvalFailure, WorkspaceAccess, WriteProgress } from './types.ts';
export { EvalOutcome } from './constants.ts';
/** Runs suites and recovers or cleans their saved work without replacing completed stages. @public */
export { runEval, resumeEval, runReplyEval, cleanupEval } from './run-eval.ts';
/** Composes the canonical client and selected MCP transport for an eval workspace. @public */
export { createEvalTarget, localTransport } from './create-eval-target.ts';
/** Identifies the executing runner bytes for experiment provenance. @public */
export { evalRunnerFingerprint } from './eval-runner-fingerprint.ts';
/** Hashes explicitly selected application sources independently of terminal and documentation code. @public */
export { fingerprintEvalSources } from './fingerprint-eval-sources.ts';
/** Couples an external suite's grade schema with its typed decoder. @public */
export { defineGradeSchema } from './define-grade-schema.ts';
/** Freezes evidence and its digest for grading and calibration. @public */
export { createEvidenceRecord } from './create-evidence-record.ts';
/** Hosts authenticated fixture tools with durable receipts for suite adapters. @public */
export { hostEnvironment } from './environment/host-environment.ts';
/** Owns a temporary bridge from a hosted runtime to the local fixture. @public */
export { createCloudflaredTransport } from './environment/cloudflared-transport.ts';
/** Reads authoritative saved stages for external inspection and audits. @public */
export { readEval } from './store/application-store.ts';
/** Validates declared schemas and experiment settings without model work. @public */
export { validateEvalSuite } from './plan-application.ts';
/** Provides typed adapter, transport, and missing-manifest failures to SDK consumers. @public */
export {
  EvalAdapterFailed,
  EvalAdapterOperation,
  EvalManifestMissing,
  EvalTransportFailed,
  EvalTransportOperation,
} from './errors.ts';
/** Defines the application adapter and saved-record interfaces accepted by the public runner. @public */
export type {
  Json,
  EvalTarget,
  OpenEvalTransport,
  EvalEnvironment,
  EvalSuite,
  EvalGradeSchema,
  ExecuteToolInput,
  OpenEnvironmentInput,
  CollectEvidenceInput,
  CollectedEvidence,
  ValidateGradeInput,
  ObservationJournal,
  SavedEval,
  EvalTrialSnapshot,
  RunApplicationEvalInput,
} from './application-types.ts';
/** Decodes saved manifests, observations, evidence, grades, and cleanup records for SDK consumers. @public */
export {
  EvalTrialId,
  EvalCallId,
  EvalManifest,
  EvalSuiteDefinition,
  EvalBounds,
  EvalToolDefinition,
  EvalToolResult,
  Observation,
  EvidenceRecord,
  RoleRecord,
  StructuredGradeRecord,
  CleanupRecord,
} from './application-schemas.ts';
/** Appends judge-only audits without executing a subject or replacing original results. @public */
export { regradeEval, calibrateEval } from './judge/audit-eval.ts';
/** Supplies explicit judge configurations and calibration inputs to the audit operations. @public */
export type { AuditJudge, CalibrationExample, RegradeEvalInput, CalibrateEvalInput } from './judge/audit-eval.ts';
/** Inspects saved work without credentials or network access. @public */
export { inspectEval } from './report/inspect-eval.ts';
/** Projects authoritative records using the selected grade interpretation. @public */
export { evalInspection, DEFAULT_INSPECTION_OPTIONS } from './report/eval-inspection.ts';
/** Selects inspected trials and their suite's grade interpretation. @public */
export type { InspectionOptions } from './report/eval-inspection.ts';
/** Compares compatible experiments and reports disclosed differences. @public */
export { compareEval, DEFAULT_COMPARISON_OPTIONS } from './report/compare-eval.ts';
/** Selects meaningful grade differences for a suite. @public */
export type { ComparisonOptions } from './report/compare-eval.ts';
/** Formats read-only projections for external CLI consumers. @public */
export { inspectionLines, comparisonLines } from './report/inspection-lines.ts';
/** Decodes the public read-only inspection projection. @public */
export { EvalInspection } from './report/inspection-schemas.ts';
/** Describes a projected grade, its interpretation, and the inspected scope. @public */
export type { GradeQuality, QualityKind, InspectionScope } from './report/inspection-schemas.ts';
/** Decodes the public comparison projection. @public */
export { EvalComparison } from './report/comparison-schemas.ts';
/** Inspects calibration against its frozen labels, with explicit missing and unavailable outcomes. @public */
export {
  inspectCalibration,
  calibrationLines,
  EvalCalibration,
  CalibrationStatus,
} from './report/calibration-inspection.ts';
/** Defines application-specific agreement between a saved expectation and an observed grade. @public */
export type { CompareCalibration } from './report/calibration-inspection.ts';
/** Describes per-trial changes in a comparison. @public */
export type { GradeDifference, GradeChange } from './report/comparison-schemas.ts';
/** Defines a suite's conversion from structured grades to visible quality. @public */
export type { ProjectGrade, ProjectGradeInput } from './report/grade-quality.ts';
/** Defines a suite's comparison between projected grades. @public */
export type { CompareGrades, CompareGradesInput } from './report/compare-eval.ts';
