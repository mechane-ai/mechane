import { EvidenceDescriptor } from '@mechane/protocol';
import type { EvidenceArtifact } from '@mechane/protocol';
import { Bytes, EvidenceArtifactId, EvidenceMachineId } from '@mechane/records';
import type { MachineId } from '@mechane/records';
import type { SandboxStore } from '@mechane/sandbox-store';
import { BrowserArtifact, SandboxBrowserArtifactAnswer } from '@mechane/sandbox-wire';
import { Option, Result, Schema } from 'effect';
import { Base64 } from 'effect/encoding';
import type { ReadCapture } from './browser-evidence.types.ts';
import { finalizeEvidence, uploadEvidenceChunk } from './evidence-write.ts';

const CaptureStep = { Validate: 'validate', Read: 'read', Upload: 'upload', Finalize: 'finalize' } as const;

class BrowserCaptureFailed extends Schema.TaggedError<BrowserCaptureFailed>()('BrowserCaptureFailed', {
  artifactId: EvidenceArtifactId,
  step: Schema.Enum(CaptureStep),
  reason: Schema.String,
  isRetryable: Schema.Boolean,
}) {}

type SaveCaptureInput = {
  readonly store: SandboxStore;
  readonly bucket: R2Bucket;
  readonly machineId: MachineId;
  readonly artifact: BrowserArtifact;
  readonly evidence: EvidenceArtifact;
  readonly readArtifact: ReadCapture;
};

/** Publication reads the original capture in bounded chunks; it never asks the browser to take another image. */
export async function saveBrowserCapture({
  store,
  bucket,
  machineId,
  artifact,
  evidence,
  readArtifact,
}: SaveCaptureInput): Promise<Result.Result<EvidenceArtifact, BrowserCaptureFailed>> {
  const artifactId = evidence.artifactId;

  if (artifact.artifactId !== artifactId) {
    const failure = new BrowserCaptureFailed({
      artifactId,
      step: CaptureStep.Validate,
      reason: 'Browser capture identity differs from its pending receipt',
      isRetryable: false,
    });

    return Result.fail(failure);
  }

  const descriptor: EvidenceDescriptor = { ...artifact, machineId: EvidenceMachineId.make(machineId) };

  if (Option.isSome(evidence.descriptor)) {
    const descriptorCodec = Schema.fromJsonString(EvidenceDescriptor);
    const recordedDescriptor = Schema.encodeSync(descriptorCodec)(evidence.descriptor.value);
    const capturedDescriptor = Schema.encodeSync(descriptorCodec)(descriptor);

    if (recordedDescriptor !== capturedDescriptor) {
      const failure = new BrowserCaptureFailed({
        artifactId,
        step: CaptureStep.Validate,
        reason: 'Browser capture descriptor differs from its immutable receipt',
        isRetryable: false,
      });

      return Result.fail(failure);
    }
  } else {
    const uploaded = await uploadCapture({ store, bucket, machineId, artifact, evidence, readArtifact });

    if (Result.isFailure(uploaded)) {
      return Result.fail(uploaded.failure);
    }
  }

  const finalized = await finalizeEvidence({ store, bucket, artifactId, descriptor });

  return Result.mapError(
    finalized,
    ({ reason, isRetryable }) =>
      new BrowserCaptureFailed({ artifactId, step: CaptureStep.Finalize, reason, isRetryable }),
  );
}

async function uploadCapture({
  store,
  bucket,
  machineId,
  artifact,
  evidence,
  readArtifact,
}: SaveCaptureInput): Promise<Result.Result<void, BrowserCaptureFailed>> {
  const artifactId = evidence.artifactId;
  const artifactCodec = Schema.fromJsonString(BrowserArtifact);
  const expectedArtifact = Schema.encodeSync(artifactCodec)(artifact);

  for (let offset = 0; offset < artifact.sizeBytes;) {
    const answer = await readArtifact({ machineId, request: { artifactId, offset } });

    if (SandboxBrowserArtifactAnswer.guards.Failed(answer)) {
      const failure = new BrowserCaptureFailed({
        artifactId,
        step: CaptureStep.Read,
        reason: answer.reason,
        isRetryable: true,
      });

      return Result.fail(failure);
    }

    if (!SandboxBrowserArtifactAnswer.guards.Ready(answer)) {
      const failure = new BrowserCaptureFailed({
        artifactId,
        step: CaptureStep.Read,
        reason: 'Capture bytes are no longer available on their original machine',
        isRetryable: false,
      });

      return Result.fail(failure);
    }

    const { part } = answer;
    const decoded = Base64.decode(part.base64);

    if (Result.isFailure(decoded)) {
      const failure = new BrowserCaptureFailed({
        artifactId,
        step: CaptureStep.Read,
        reason: 'Capture chunk has invalid base64',
        isRetryable: false,
      });

      return Result.fail(failure);
    }

    const bytes = new Uint8Array(decoded.success);
    const endOffset = offset + bytes.byteLength;
    const isArtifactChanged = Schema.encodeSync(artifactCodec)(part.artifact) !== expectedArtifact;
    const isInvalidRange = part.offset !== offset || bytes.byteLength === 0 || endOffset > artifact.sizeBytes;
    const isLastMismatch = part.isLast !== (endOffset === artifact.sizeBytes);

    if (isArtifactChanged || isInvalidRange || isLastMismatch) {
      const failure = new BrowserCaptureFailed({
        artifactId,
        step: CaptureStep.Validate,
        reason: 'Capture chunk differs from its immutable artifact',
        isRetryable: false,
      });

      return Result.fail(failure);
    }

    const offsetBytes = Bytes.make(offset);
    const uploaded = await uploadEvidenceChunk({ store, bucket, artifactId, offsetBytes, bytes });

    if (Result.isFailure(uploaded)) {
      const failure = new BrowserCaptureFailed({
        artifactId,
        step: CaptureStep.Upload,
        reason: uploaded.failure.reason,
        isRetryable: uploaded.failure.isRetryable,
      });

      return Result.fail(failure);
    }

    offset = endOffset;
  }

  return Result.succeed(undefined);
}
