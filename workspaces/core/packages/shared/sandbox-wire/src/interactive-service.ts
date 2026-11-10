import { MachineId, ModelToolCallId, RecordText, SessionId } from '@mechane/records';
import { Schema } from 'effect';
import { BrowserArtifactPart, BrowserRequest, BrowserRequestId, BrowserResponse } from './browser/schemas.ts';
import { ExecutionEnvironmentRequired } from './execution-environment.ts';
import { SandboxRunId } from './interactive.ts';
import { ProcessCanceled, ProcessId, ProcessObservation, ProcessStart } from './processes/process.schemas.ts';
import { SandboxExecutionRefusal, SandboxServiceIdentity } from './service.ts';

/** A pending start can be rejoined without creating another process. */
export const ProcessPending = Schema.TaggedStruct('ProcessPending', {});
export type ProcessPending = typeof ProcessPending.Type;

/** Native process submission preserves original identity parts alongside its derived handle. */
export const SandboxProcessSubmission = Schema.Struct({
  runId: SandboxRunId,
  toolCallId: ModelToolCallId,
  request: ProcessStart,
});

export type SandboxProcessSubmission = typeof SandboxProcessSubmission.Type;

/** Process receipts distinguish admission waits, cancellation, credentials, and policy refusal. */
export const SandboxProcessAnswer = Schema.Union([
  ProcessObservation,
  ProcessPending,
  ProcessCanceled,
  ExecutionEnvironmentRequired,
  SandboxExecutionRefusal,
]);

export type SandboxProcessAnswer = typeof SandboxProcessAnswer.Type;

/** Original identities address observation without allowing a replacement machine allocation. */
export const SandboxProcessIdentity = Schema.Struct({ ...SandboxServiceIdentity.fields, processId: ProcessId });
export type SandboxProcessIdentity = typeof SandboxProcessIdentity.Type;

/** Cancellation fences every interactive action originating in this native run. */
export const SandboxRunIdentity = Schema.Struct({ ...SandboxServiceIdentity.fields, runId: SandboxRunId });
export type SandboxRunIdentity = typeof SandboxRunIdentity.Type;

/** Browser submission retains trusted native identity separately from its derived request ID. */
export const SandboxBrowserSubmission = Schema.Struct({
  runId: SandboxRunId,
  sessionId: SessionId,
  toolCallId: ModelToolCallId,
  request: BrowserRequest,
});

export type SandboxBrowserSubmission = typeof SandboxBrowserSubmission.Type;

/** A browser receipt either records actual effects or explicitly leaves their result uncertain. */
export const BrowserProgress = Schema.TaggedUnion({
  Ready: { machineId: MachineId, response: BrowserResponse },
  Pending: {
    reason: RecordText,
    /** Only a matching unassigned claim permits a fresh, authorized submission of the same action. */
    isDispatchRequired: Schema.Boolean,
  },
  Uncertain: { reason: RecordText },
  Failed: { reason: RecordText },
});

export type BrowserProgress = typeof BrowserProgress.Type;

/** The action receipt remains authoritative; abandonment only confirms that it cannot dispatch. */
export const SandboxBrowserAbandonResult = Schema.Struct({ isAbandoned: Schema.Boolean });
export type SandboxBrowserAbandonResult = typeof SandboxBrowserAbandonResult.Type;

/** Browser artifacts are read only from their original machine and capture identity. */
export const SandboxBrowserArtifactAnswer = Schema.TaggedUnion({
  Ready: { part: BrowserArtifactPart },
  Missing: {},
  Failed: { reason: RecordText },
});

export type SandboxBrowserArtifactAnswer = typeof SandboxBrowserArtifactAnswer.Type;

/** Private browser receipt address shared by submission and observation. */
export const SandboxBrowserIdentity = Schema.Struct({ ...SandboxServiceIdentity.fields, requestId: BrowserRequestId });
export type SandboxBrowserIdentity = typeof SandboxBrowserIdentity.Type;
