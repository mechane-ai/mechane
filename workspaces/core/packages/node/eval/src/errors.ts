import { MechId, Micros } from '@mechane/records';
import { Schema } from 'effect';
import { EvalFileStep } from './constants.ts';

/** Setup and adapter failures retain the boundary that rejected their input. */
export const EvalAdapterOperation = {
  Application: 'application adapter',
  ValidateTarget: 'validate eval target',
  DefineGradeSchema: 'define grade schema',
  DecodeGrade: 'decode grade',
  DecodeGradeJson: 'decode grade JSON',
  ValidateSuite: 'validate suite',
  ValidateJudge: 'validate judge',
  ValidateGradeSchema: 'validate grade schema',
  ValidateJudgeCapabilities: 'validate judge capabilities',
  ValidateJudgeRubric: 'validate judge rubric',
  ValidateToolDefinition: 'validate tool definition',
  CheckRuntime: 'check eval runtime',
  StartEval: 'start eval',
  CleanEval: 'clean eval',
  ReadFrozenCase: 'read frozen case',
  FreezeEvidence: 'freeze evidence',
  ReadEvidence: 'read frozen evidence',
  ReadManifest: 'read eval manifest',
  ReadCallIdentity: 'read MCP call identity',
  ExecuteTool: 'execute eval tool',
  ReplayTool: 'replay tool call',
  RecordTool: 'record tool call',
  RecordToolResult: 'record tool result',
  ValidateRoleSettings: 'validate role settings',
  VerifyRoleCapabilities: 'verify role capabilities',
  VerifyRoleSettings: 'verify role settings',
  ReconcileConnection: 'reconcile role connection',
  CancelRole: 'cancel eval role',
  DecodeReplyInput: 'decode reply evidence input',
  DecodeReplyGrade: 'decode reply grade',
  DecodeReplyRubric: 'decode reply rubric',
  ValidateReplyCriteria: 'validate reply grade criteria',
  ExecuteReplyTool: 'execute reply-suite tool',
  SaveGradeSubmission: 'save grade submission',
  ValidateSavedGrade: 'validate saved grade',
  ValidateAuditId: 'validate audit id',
  FindAuditCase: 'find audit case',
  ValidateRegradeSuite: 'validate regrade suite',
  ValidateCalibrationExamples: 'validate calibration examples',
} as const;

/** Transport failures identify the owned listener or bridge operation. */
export const EvalTransportOperation = {
  External: 'application transport',
  ServeRequest: 'serve MCP request',
  Listen: 'listen for eval tools',
  ReadListener: 'read eval listener',
  ReadRequest: 'read MCP request',
  CloseListener: 'close eval listener',
  JoinRequests: 'join eval requests',
  StartCloudflared: 'start cloudflared',
  OpenCloudflared: 'open cloudflared',
  ReadCloudflaredOrigin: 'read cloudflared origin',
  ProbeCloudflared: 'probe cloudflared',
  CloseCloudflared: 'close cloudflared',
} as const;

/** Invalid suite setup or evidence remains separate from a model's quality grade. */
export class EvalAdapterFailed extends Schema.TaggedError<EvalAdapterFailed>()('EvalAdapterFailed', {
  operation: Schema.Enum(EvalAdapterOperation),
  reason: Schema.String,
}) {
  override get message(): string {
    return `${this.operation}: ${this.reason}`;
  }
}

/** Transport failures leave their accepted operation identities available for recovery. */
export class EvalTransportFailed extends Schema.TaggedError<EvalTransportFailed>()('EvalTransportFailed', {
  operation: Schema.Enum(EvalTransportOperation),
  reason: Schema.String,
}) {
  override get message(): string {
    return `${this.operation}: ${this.reason}`;
  }
}

/** Historical projections are inspectable but cannot supply resumable stage records. */
export class EvalManifestMissing extends Schema.TaggedError<EvalManifestMissing>()('EvalManifestMissing', {
  outFolder: Schema.String,
}) {}

/** The turns a plan has not saved yet could, each at its mech's cap, spend more than the day's allowance has left. */
export class AllowanceExhausted extends Schema.TaggedError<AllowanceExhausted>()('AllowanceExhausted', {
  day: Schema.String,
  neededMicros: Micros,
  remainingMicros: Micros,
}) {}

/** A step on a file or folder of the out folder failed; `path` names what the step read, wrote or removed. */
export class EvalFileFailed extends Schema.TaggedError<EvalFileFailed>()('EvalFileFailed', {
  step: Schema.Enum(EvalFileStep),
  path: Schema.String,
  reason: Schema.String,
}) {}

/** Ctrl-C interrupted an eval run once its finalizers ran; every record it saved stays, so a rerun resumes. */
export class EvalInterrupted extends Schema.TaggedError<EvalInterrupted>()('EvalInterrupted', {
  outFolder: Schema.String,
}) {}

/** The runtime response cannot establish a role's completion; saved intent remains available for a retry. */
export class EvalResponseInvalid extends Schema.TaggedError<EvalResponseInvalid>()('EvalResponseInvalid', {
  mechId: MechId,
  reason: Schema.String,
}) {}

/** The kernel still holds another writer's lock on this run directory. */
export class OutFolderBusy extends Schema.TaggedError<OutFolderBusy>()('OutFolderBusy', { path: Schema.String }) {}

/**
 * The out folder holds the plan of another suite, release, worker revision or workspace, whose records a run never
 * mixes with its own.
 */
export class PlanChanged extends Schema.TaggedError<PlanChanged>()('PlanChanged', {
  path: Schema.String,
  savedDigest: Schema.String,
  plannedDigest: Schema.String,
}) {}

/** The suite file could not be read, or does not decode as a suite, for `reason`. */
export class SuiteInvalid extends Schema.TaggedError<SuiteInvalid>()('SuiteInvalid', {
  path: Schema.String,
  reason: Schema.String,
}) {}
