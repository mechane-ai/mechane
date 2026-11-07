import {
  EVIDENCE_ARTIFACT_MAX_BYTES,
  EVIDENCE_CHUNK_MAX_BYTES,
  EVIDENCE_MECH_MAX_ARTIFACTS,
  EVIDENCE_MECH_MAX_BYTES,
  EvidenceArtifact,
  EvidenceDescriptor,
  EvidenceKind,
  EvidenceStatus,
} from '@mechane/protocol';
import { Bytes, EvidenceArtifactId, MediaType } from '@mechane/records';
import { commitEvidenceObject, EvidenceIntegrityFailed, stageEvidenceChunk } from '@mechane/sandbox-store';
import type { EvidenceChunk, SandboxStore } from '@mechane/sandbox-store';
import { capturePromise } from '@mechane/utilities';
import { DateTime, Number, Option, Result, Schema } from 'effect';
import { Hex } from 'effect/encoding';
import { cleanupReadyEvidence } from './evidence-cleanup.ts';

const EvidenceWriteStep = { Allocate: 'allocate', Upload: 'upload', Finalize: 'finalize', Fail: 'fail' } as const;

class EvidenceWriteFailed extends Schema.TaggedError<EvidenceWriteFailed>()('EvidenceWriteFailed', {
  artifactId: EvidenceArtifactId,
  step: Schema.Enum(EvidenceWriteStep),
  reason: Schema.String,
  isRetryable: Schema.Boolean,
}) {}

type ArtifactResult = Result.Result<EvidenceArtifact, EvidenceWriteFailed>;
type StoreInput = { readonly store: SandboxStore };

type IdentityInput = Pick<
  EvidenceArtifact,
  'artifactId' | 'workspaceId' | 'mechId' | 'sessionId' | 'turnId' | 'executionId' | 'toolCallId' | 'kind'
>;

type ArtifactInput = StoreInput & Pick<EvidenceArtifact, 'artifactId'>;

type UploadInput = ArtifactInput & {
  readonly bucket: R2Bucket;
  readonly offsetBytes: Bytes;
  readonly bytes: Uint8Array<ArrayBuffer>;
};

type FinalizeInput = ArtifactInput & { readonly bucket: R2Bucket; readonly descriptor: EvidenceDescriptor };
type FailInput = ArtifactInput & { readonly reason: string };

/** Allocation precedes capture, and a replay returns the original receipt without capturing again. */
export async function allocatePendingEvidence({
  store,
  ...identity
}: StoreInput & IdentityInput): Promise<ArtifactResult> {
  return store.atomic({ run: () => allocateEvidence({ tables: store, identity }) });
}

type AllocateInput = { readonly tables: SandboxStore; readonly identity: IdentityInput };

function allocateEvidence({ tables, identity }: AllocateInput): ArtifactResult {
  const capacity = tables.capacity();

  if (Option.isNone(capacity)) {
    const failure = new EvidenceWriteFailed({
      artifactId: identity.artifactId,
      step: EvidenceWriteStep.Allocate,
      reason: 'capture owner is unavailable',
      isRetryable: false,
    });

    return Result.fail(failure);
  }

  const owner = capacity.value.owner;
  const isOwnerMatching = owner.workspaceId === identity.workspaceId && owner.mechId === identity.mechId;

  if (!isOwnerMatching) {
    const failure = new EvidenceWriteFailed({
      artifactId: identity.artifactId,
      step: EvidenceWriteStep.Allocate,
      reason: 'capture owner differs from the sandbox owner',
      isRetryable: false,
    });

    return Result.fail(failure);
  }

  const existing = tables.evidenceForCall(identity);

  if (Option.isSome(existing)) {
    const isMatching = sameEvidenceIdentity({ previous: existing.value, requested: identity });

    if (!isMatching) {
      const failure = new EvidenceWriteFailed({
        artifactId: identity.artifactId,
        step: EvidenceWriteStep.Allocate,
        reason: 'native tool call already owns another capture',
        isRetryable: false,
      });

      return Result.fail(failure);
    }

    return Result.succeed(existing.value);
  }

  const allocatedArtifact = tables.evidenceArtifact(identity);

  if (Option.isSome(allocatedArtifact)) {
    const failure = new EvidenceWriteFailed({
      artifactId: identity.artifactId,
      step: EvidenceWriteStep.Allocate,
      reason: 'capture identity already belongs to another tool call',
      isRetryable: false,
    });

    return Result.fail(failure);
  }

  if (tables.evidenceUsage().artifactCount >= EVIDENCE_MECH_MAX_ARTIFACTS) {
    const failure = new EvidenceWriteFailed({
      artifactId: identity.artifactId,
      step: EvidenceWriteStep.Allocate,
      reason: 'mech evidence count limit reached',
      isRetryable: false,
    });

    return Result.fail(failure);
  }

  const artifact: EvidenceArtifact = {
    ...identity,
    status: EvidenceStatus.Pending,
    createdAt: DateTime.nowUnsafe(),
    completedAt: Option.none(),
    descriptor: Option.none(),
    failureReason: Option.none(),
  };

  const artifactType = Schema.toType(EvidenceArtifact);
  const checked = Schema.decodeUnknownResult(artifactType)(artifact);

  if (Result.isFailure(checked)) {
    const failure = new EvidenceWriteFailed({
      artifactId: identity.artifactId,
      step: EvidenceWriteStep.Allocate,
      reason: checked.failure.message,
      isRetryable: false,
    });

    return Result.fail(failure);
  }

  tables.insertEvidenceArtifact({ artifact });

  return Result.succeed(artifact);
}

/** The immutable chunk receipt is saved before the R2 write, so retries cannot substitute bytes. */
export async function uploadEvidenceChunk({
  store,
  bucket,
  artifactId,
  offsetBytes,
  bytes,
}: UploadInput): Promise<ArtifactResult> {
  const isInvalidOffset = !globalThis.Number.isSafeInteger(offsetBytes) || offsetBytes < 0;
  const isInvalidSize = bytes.byteLength === 0 || bytes.byteLength > EVIDENCE_CHUNK_MAX_BYTES;

  if (isInvalidOffset || isInvalidSize) {
    const failure = new EvidenceWriteFailed({
      artifactId,
      step: EvidenceWriteStep.Upload,
      reason: 'capture chunk exceeds its byte boundary',
      isRetryable: false,
    });

    return Result.fail(failure);
  }

  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const digestBytes = new Uint8Array(digest);
  const sha256 = Hex.encode(digestBytes);
  const sizeBytes = Bytes.make(bytes.byteLength);
  const chunk = { offsetBytes, sizeBytes, sha256 };
  const prepared = store.atomic({ run: () => prepareChunk({ tables: store, artifactId, chunk }) });

  if (Result.isFailure(prepared)) {
    return prepared;
  }

  if (prepared.success.status === EvidenceStatus.Ready) {
    await cleanupReadyEvidence({ store, bucket, artifact: prepared.success });

    return prepared;
  }

  const promise = stageEvidenceChunk({ bucket, ...prepared.success, chunk, bytes });
  const uploaded = await capturePromise({ promise });

  if (Result.isFailure(uploaded)) {
    const reason = String(uploaded.failure);
    const failure = new EvidenceWriteFailed({ artifactId, step: EvidenceWriteStep.Upload, reason, isRetryable: true });

    return Result.fail(failure);
  }

  return prepared;
}

type PrepareChunkInput = {
  readonly tables: SandboxStore;
  readonly artifactId: EvidenceArtifactId;
  readonly chunk: EvidenceChunk;
};

function prepareChunk({ tables, artifactId, chunk }: PrepareChunkInput): ArtifactResult {
  const current = evidenceForWrite({ tables, artifactId, step: EvidenceWriteStep.Upload });

  if (Result.isFailure(current)) {
    return current;
  }

  const artifact = current.success;

  const chunks = tables.evidenceChunks({ artifactId });
  const foundChunk = chunks.find(({ offsetBytes }) => offsetBytes === chunk.offsetBytes);
  const existing = Option.fromUndefinedOr(foundChunk);

  if (Option.isSome(existing)) {
    if (existing.value.sha256 !== chunk.sha256 || existing.value.sizeBytes !== chunk.sizeBytes) {
      const failure = new EvidenceWriteFailed({
        artifactId,
        step: EvidenceWriteStep.Upload,
        reason: 'capture chunk differs from its receipt',
        isRetryable: false,
      });

      return Result.fail(failure);
    }

    return Result.succeed(artifact);
  }

  const sizes = chunks.map(({ sizeBytes }) => sizeBytes);
  const uploadedBytes = Number.sumAll(sizes);

  if (
    Option.isSome(artifact.descriptor) ||
    uploadedBytes !== chunk.offsetBytes ||
    uploadedBytes + chunk.sizeBytes > EVIDENCE_ARTIFACT_MAX_BYTES
  ) {
    const failure = new EvidenceWriteFailed({
      artifactId,
      step: EvidenceWriteStep.Upload,
      reason: 'capture chunk is outside the pending upload',
      isRetryable: false,
    });

    return Result.fail(failure);
  }

  if (tables.evidenceUsage().sizeBytes + chunk.sizeBytes > EVIDENCE_MECH_MAX_BYTES) {
    const failure = new EvidenceWriteFailed({
      artifactId,
      step: EvidenceWriteStep.Upload,
      reason: 'mech evidence byte limit reached',
      isRetryable: false,
    });

    return Result.fail(failure);
  }

  tables.insertEvidenceChunk({ artifactId, chunk });

  return Result.succeed(artifact);
}

/** The descriptor is fixed before upload; only a verified R2 write can commit Ready. */
export async function finalizeEvidence({
  store,
  bucket,
  artifactId,
  descriptor,
}: FinalizeInput): Promise<ArtifactResult> {
  const descriptorType = Schema.toType(EvidenceDescriptor);
  const checked = Schema.decodeUnknownResult(descriptorType)(descriptor);

  if (Result.isFailure(checked)) {
    const failure = new EvidenceWriteFailed({
      artifactId,
      step: EvidenceWriteStep.Finalize,
      reason: checked.failure.message,
      isRetryable: false,
    });

    return Result.fail(failure);
  }

  const prepared = store.atomic({ run: () => prepareFinalization({ tables: store, artifactId, descriptor }) });

  if (Result.isFailure(prepared)) {
    return prepared;
  }

  const chunks = store.atomic({ run: () => store.evidenceChunks({ artifactId }) });
  const promise = commitEvidenceObject({ bucket, ...prepared.success, descriptor, chunks });
  const committed = await capturePromise({ promise });

  if (Result.isFailure(committed)) {
    const reason = String(committed.failure);

    const failure = new EvidenceWriteFailed({
      artifactId,
      step: EvidenceWriteStep.Finalize,
      reason,
      isRetryable: true,
    });

    return Result.fail(failure);
  }

  if (Result.isFailure(committed.success)) {
    const cause = committed.success.failure;
    const reason = cause.reason;
    const isRetryable = !Schema.is(EvidenceIntegrityFailed)(cause);

    const failure = new EvidenceWriteFailed({ artifactId, step: EvidenceWriteStep.Finalize, reason, isRetryable });

    return Result.fail(failure);
  }

  const completed = store.atomic({ run: () => completeEvidence({ tables: store, artifactId }) });

  if (Result.isSuccess(completed)) {
    await cleanupReadyEvidence({ store, bucket, artifact: completed.success });
  }

  return completed;
}

type PrepareFinalizationInput = {
  readonly tables: SandboxStore;
  readonly artifactId: EvidenceArtifactId;
  readonly descriptor: EvidenceDescriptor;
};

function prepareFinalization({ tables, artifactId, descriptor }: PrepareFinalizationInput): ArtifactResult {
  const current = evidenceForWrite({ tables, artifactId, step: EvidenceWriteStep.Finalize });

  if (Result.isFailure(current)) {
    return current;
  }

  const artifact = current.success;
  const isRecording = artifact.kind === EvidenceKind.Recording;

  if (isRecording !== (descriptor.mediaType === MediaType.Mp4)) {
    const failure = new EvidenceWriteFailed({
      artifactId,
      step: EvidenceWriteStep.Finalize,
      reason: 'capture media type differs from its kind',
      isRetryable: false,
    });

    return Result.fail(failure);
  }

  if (Option.isSome(artifact.descriptor)) {
    const recorded = Schema.encodeSync(EvidenceDescriptor)(artifact.descriptor.value);
    const requested = Schema.encodeSync(EvidenceDescriptor)(descriptor);

    if (JSON.stringify(recorded) !== JSON.stringify(requested)) {
      const failure = new EvidenceWriteFailed({
        artifactId,
        step: EvidenceWriteStep.Finalize,
        reason: 'capture descriptor differs from its receipt',
        isRetryable: false,
      });

      return Result.fail(failure);
    }

    return Result.succeed(artifact);
  }

  const sizes = tables.evidenceChunks({ artifactId }).map(({ sizeBytes }) => sizeBytes);

  if (Number.sumAll(sizes) !== descriptor.sizeBytes) {
    const failure = new EvidenceWriteFailed({
      artifactId,
      step: EvidenceWriteStep.Finalize,
      reason: 'capture byte count differs from its receipt',
      isRetryable: false,
    });

    return Result.fail(failure);
  }

  const pending = { ...artifact, descriptor: Option.some(descriptor) };

  tables.saveEvidenceArtifact({ artifact: pending });

  return Result.succeed(pending);
}

type CompleteInput = { readonly tables: SandboxStore; readonly artifactId: EvidenceArtifactId };

function completeEvidence({ tables, artifactId }: CompleteInput): ArtifactResult {
  const current = evidenceForWrite({ tables, artifactId, step: EvidenceWriteStep.Finalize });

  if (Result.isFailure(current) || current.success.status === EvidenceStatus.Ready) {
    return current;
  }

  const completedAt = DateTime.nowUnsafe();
  const artifact = { ...current.success, status: EvidenceStatus.Ready, completedAt: Option.some(completedAt) };

  tables.saveEvidenceArtifact({ artifact });

  return Result.succeed(artifact);
}

/** Only pending receipts become failed; ready evidence remains immutable. */
export async function failEvidence({ store, artifactId, reason }: FailInput): Promise<ArtifactResult> {
  return store.atomic({
    run: () => {
      const tables = store;
      const found = tables.evidenceArtifact({ artifactId });

      if (Option.isNone(found)) {
        const failure = new EvidenceWriteFailed({
          artifactId,
          step: EvidenceWriteStep.Fail,
          reason: 'capture is unavailable',
          isRetryable: false,
        });

        return Result.fail(failure);
      }

      if (found.value.status !== EvidenceStatus.Pending) {
        return Result.succeed(found.value);
      }

      const completedAt = DateTime.nowUnsafe();

      const artifact = {
        ...found.value,
        status: EvidenceStatus.Failed,
        failureReason: Option.some(reason),
        completedAt: Option.some(completedAt),
      };

      tables.saveEvidenceArtifact({ artifact });

      return Result.succeed(artifact);
    },
  });
}

type EvidenceForWriteInput = CompleteInput & { readonly step: EvidenceWriteFailed['step'] };

function evidenceForWrite({ tables, artifactId, step }: EvidenceForWriteInput): ArtifactResult {
  const found = tables.evidenceArtifact({ artifactId });

  if (Option.isNone(found) || found.value.status === EvidenceStatus.Failed) {
    const failure = new EvidenceWriteFailed({ artifactId, step, reason: 'capture is unavailable', isRetryable: false });

    return Result.fail(failure);
  }

  return Result.succeed(found.value);
}

type IdentityMatchInput = { readonly previous: IdentityInput; readonly requested: IdentityInput };

function sameEvidenceIdentity({ previous, requested }: IdentityMatchInput): boolean {
  const previousRun = Option.getOrNull(previous.turnId);
  const requestedRun = Option.getOrNull(requested.turnId);

  const isSameContext =
    previous.workspaceId === requested.workspaceId &&
    previous.mechId === requested.mechId &&
    previous.sessionId === requested.sessionId;

  const isSameCall =
    previous.executionId === requested.executionId &&
    previous.toolCallId === requested.toolCallId &&
    previousRun === requestedRun;

  const isSameCapture = previous.artifactId === requested.artifactId && previous.kind === requested.kind;

  return isSameContext && isSameCall && isSameCapture;
}
