import { EvidenceKind, EvidenceStatus } from '@mechane/protocol';
import type { BrowserEvidenceProgress, EvidenceArtifact } from '@mechane/protocol';
import { EvidenceArtifactId, TurnId } from '@mechane/records';
import type { ModelToolCallId, SessionId } from '@mechane/records';
import type { SandboxStore } from '@mechane/sandbox-store';
import { BrowserAction, BrowserProgress, BrowserResult, ExecutionId } from '@mechane/sandbox-wire';
import type { BrowserRequest, SandboxOwner, SandboxRunId } from '@mechane/sandbox-wire';
import { Option, Result, Schema } from 'effect';
import type { ReadCapture } from './browser-evidence.types.ts';
import { cleanupReadyEvidence } from './evidence-cleanup.ts';
import { allocatePendingEvidence, failEvidence } from './evidence-write.ts';
import { saveBrowserCapture } from './save-browser-capture.ts';

const CapturePreparationStep = { Allocate: 'allocate', Recording: 'recording' } as const;

class CapturePreparationFailed extends Schema.TaggedError<CapturePreparationFailed>()('CapturePreparationFailed', {
  artifactId: EvidenceArtifactId,
  step: Schema.Enum(CapturePreparationStep),
  reason: Schema.String,
}) {}

type BrowserIdentity = SandboxOwner & {
  readonly runId: SandboxRunId;
  readonly sessionId: SessionId;
  readonly toolCallId: ModelToolCallId;
};

type BrowserEvidenceInput = {
  readonly store: SandboxStore;
  readonly bucket: R2Bucket;
  readonly identity: BrowserIdentity;
  readonly request: BrowserRequest;
  readonly dispatch: () => Promise<BrowserProgress>;
  readonly readArtifact: ReadCapture;
};

/** Captures reserve their receipt before the journaled action and resume publication without recapturing. */
export async function runBrowserWithEvidence({
  store,
  bucket,
  identity,
  request,
  dispatch,
  readArtifact,
}: BrowserEvidenceInput): Promise<BrowserEvidenceProgress> {
  const prepared = await prepareCapture({ store, identity, request });

  if (Result.isFailure(prepared)) {
    return {
      progress: BrowserProgress.cases.Failed.make({ reason: prepared.failure.reason }),
      evidence: Option.none(),
    };
  }

  const evidence = prepared.success;

  if (Option.isSome(evidence) && evidence.value.status === EvidenceStatus.Failed) {
    const reason = Option.getOrElse(evidence.value.failureReason, () => 'The original capture failed');

    return { progress: BrowserProgress.cases.Failed.make({ reason }), evidence };
  }

  const progress = await dispatch();

  if (Option.isNone(evidence)) {
    return { progress, evidence };
  }

  const artifact = evidence.value;

  if (artifact.status === EvidenceStatus.Ready) {
    await cleanupReadyEvidence({ store, bucket, artifact });

    return { progress, evidence };
  }

  if (BrowserProgress.guards.Pending(progress)) {
    return { progress, evidence };
  }

  if (!BrowserProgress.guards.Ready(progress)) {
    return await failCaptureProgress({ store, artifact, progress, reason: progress.reason });
  }

  const result = progress.response.result;

  if (BrowserResult.guards.Failed(result) || BrowserResult.guards.Uncertain(result)) {
    return await failCaptureProgress({ store, artifact, progress, reason: result.reason });
  }

  if (!BrowserResult.guards.Screenshot(result) && !BrowserResult.guards.Video(result)) {
    return { progress, evidence };
  }

  const saved = await saveBrowserCapture({
    store,
    bucket,
    machineId: progress.machineId,
    artifact: result.artifact,
    evidence: artifact,
    readArtifact,
  });

  if (Result.isFailure(saved)) {
    const reason = saved.failure.reason;

    if (saved.failure.isRetryable) {
      return { progress: BrowserProgress.cases.Pending.make({ reason }), evidence };
    }

    const failedProgress = BrowserProgress.cases.Failed.make({ reason });

    return await failCaptureProgress({ store, artifact, progress: failedProgress, reason });
  }

  return { progress, evidence: Option.some(saved.success) };
}

type FailCaptureInput = {
  readonly store: SandboxStore;
  readonly artifact: EvidenceArtifact;
  readonly progress: BrowserProgress;
  readonly reason: string;
};

async function failCaptureProgress({
  store,
  artifact,
  progress,
  reason,
}: FailCaptureInput): Promise<BrowserEvidenceProgress> {
  const failed = await failEvidence({ store, artifactId: artifact.artifactId, reason });
  const evidence = Result.getOrElse(failed, () => artifact);

  return { progress, evidence: Option.some(evidence) };
}

type PrepareCaptureInput = Pick<BrowserEvidenceInput, 'store' | 'request' | 'identity'>;

async function prepareCapture({
  store,
  request,
  identity,
}: PrepareCaptureInput): Promise<Result.Result<Option.Option<EvidenceArtifact>, CapturePreparationFailed>> {
  const { action, requestId } = request;

  if (BrowserAction.guards.Screenshot(action) || BrowserAction.guards.RecordStart(action)) {
    const runId = TurnId.make(identity.runId);
    const turnId = Option.some(runId);
    const artifactId = EvidenceArtifactId.make(requestId);
    const executionId = ExecutionId.make(requestId);
    const kind = captureKind({ action });

    const allocated = await allocatePendingEvidence({
      store,
      workspaceId: identity.workspaceId,
      mechId: identity.mechId,
      sessionId: identity.sessionId,
      turnId,
      executionId,
      toolCallId: identity.toolCallId,
      artifactId,
      kind,
    });

    if (Result.isFailure(allocated)) {
      const failure = new CapturePreparationFailed({
        artifactId,
        step: CapturePreparationStep.Allocate,
        reason: allocated.failure.reason,
      });

      return Result.fail(failure);
    }

    const evidence = Option.some(allocated.success);

    return Result.succeed(evidence);
  }

  if (BrowserAction.guards.RecordStop(action)) {
    const artifactId = action.recordingId;
    const found = store.evidenceArtifact({ artifactId });

    if (Option.isNone(found)) {
      const failure = new CapturePreparationFailed({
        artifactId,
        step: CapturePreparationStep.Recording,
        reason: 'Recording has no matching capture receipt',
      });

      return Result.fail(failure);
    }

    const artifact = found.value;
    const isOwnerMatching = artifact.workspaceId === identity.workspaceId && artifact.mechId === identity.mechId;

    if (!isOwnerMatching || artifact.kind !== EvidenceKind.Recording || artifact.sessionId !== identity.sessionId) {
      const failure = new CapturePreparationFailed({
        artifactId,
        step: CapturePreparationStep.Recording,
        reason: 'Recording belongs to another browser session',
      });

      return Result.fail(failure);
    }

    return Result.succeed(found);
  }

  const evidence = Option.none<EvidenceArtifact>();

  return Result.succeed(evidence);
}

type CaptureKindInput = Pick<BrowserRequest, 'action'>;

function captureKind({ action }: CaptureKindInput): EvidenceKind {
  if (BrowserAction.guards.RecordStart(action)) {
    return EvidenceKind.Recording;
  }

  return EvidenceKind.Screenshot;
}
