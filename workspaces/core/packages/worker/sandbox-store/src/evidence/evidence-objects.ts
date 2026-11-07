import { EVIDENCE_CHUNK_MAX_BYTES } from '@mechane/protocol';
import type { EvidenceDescriptor, EvidencePath } from '@mechane/protocol';
import { EvidenceArtifactId } from '@mechane/records';
import type { Bytes } from '@mechane/records';
import { Option, Result, Schema } from 'effect';
import { Hex } from 'effect/encoding';
import type { EvidenceChunk } from './evidence-records.ts';

type BucketInput = { readonly bucket: R2Bucket };
type ObjectInput = BucketInput & EvidencePath;
type ChunkObjectInput = EvidencePath & { readonly offsetBytes: Bytes };
type StageInput = ObjectInput & { readonly chunk: EvidenceChunk; readonly bytes: Uint8Array<ArrayBuffer> };

type CommitInput = ObjectInput & {
  readonly descriptor: EvidenceDescriptor;
  readonly chunks: ReadonlyArray<EvidenceChunk>;
};

/** A validated byte interval uses R2's offset and length fields for partial reads. */
export type EvidenceRange = { readonly offset: number; readonly length: number };
type ReadInput = ObjectInput & { readonly range: EvidenceRange };

const EvidenceIntegrityReason = {
  ChunkMissing: 'capture chunk is no longer available',
  ChunkMismatch: 'capture chunk differs from its immutable receipt',
  SizeMismatch: 'capture byte count differs from its immutable receipt',
  DigestMismatch: 'capture digest differs from its immutable receipt',
  ObjectMismatch: 'stored media differs from its immutable receipt',
} as const;

const PromiseSettlement = { Rejected: 'rejected' } as const;

/** Deterministic capture corruption cannot be repaired by retrying the same immutable receipt. */
export class EvidenceIntegrityFailed extends Schema.TaggedError<EvidenceIntegrityFailed>()('EvidenceIntegrityFailed', {
  artifactId: EvidenceArtifactId,
  reason: Schema.Enum(EvidenceIntegrityReason),
}) {}

class EvidenceStorageFailed extends Schema.TaggedError<EvidenceStorageFailed>()('EvidenceStorageFailed', {
  artifactId: EvidenceArtifactId,
  reason: Schema.String,
}) {}

type CommitResult = Result.Result<void, EvidenceIntegrityFailed | EvidenceStorageFailed>;

function evidenceObjectKey({ workspaceId, mechId, artifactId }: EvidencePath): string {
  return `evidence/${workspaceId}/${mechId}/${artifactId}/content`;
}

function evidenceChunkKey({ workspaceId, mechId, artifactId, offsetBytes }: ChunkObjectInput): string {
  return `evidence/${workspaceId}/${mechId}/${artifactId}/chunks/${offsetBytes}`;
}

/** A chunk receipt fixes its digest before this retryable write. */
export async function stageEvidenceChunk({ bucket, chunk, bytes, ...owner }: StageInput): Promise<void> {
  const key = evidenceChunkKey({ ...owner, offsetBytes: chunk.offsetBytes });

  await bucket.put(key, bytes, { sha256: chunk.sha256 });
}

/** Hashes bounded chunks before publication; R2 independently verifies the final fixed-length write. */
export async function commitEvidenceObject({
  bucket,
  descriptor,
  chunks,
  ...owner
}: CommitInput): Promise<CommitResult> {
  const key = evidenceObjectKey(owner);
  const existing = await bucket.head(key);
  const saved = Option.fromNullishOr(existing);

  if (Option.isSome(saved)) {
    const metadata = Option.fromUndefinedOr(saved.value.customMetadata);
    const hasDigest = Option.exists(metadata, ({ sha256 }) => sha256 === descriptor.sha256);
    const isMatching = saved.value.size === descriptor.sizeBytes && hasDigest;

    if (!isMatching) {
      const failure = new EvidenceIntegrityFailed({
        artifactId: owner.artifactId,
        reason: EvidenceIntegrityReason.ObjectMismatch,
      });

      return Result.fail(failure);
    }

    return Result.succeed(undefined);
  }

  const verified = await verifyEvidenceChunks({ bucket, descriptor, chunks, ...owner });

  if (Result.isFailure(verified)) {
    return verified;
  }

  const source = evidenceChunkStream({ bucket, chunks, ...owner });
  const fixed = new FixedLengthStream(descriptor.sizeBytes);
  const body = source.stream.pipeThrough(fixed);

  const writing = bucket.put(key, body, {
    sha256: descriptor.sha256,
    httpMetadata: { contentType: descriptor.mediaType },
    customMetadata: { sha256: descriptor.sha256 },
  });

  const [written] = await Promise.allSettled([writing]);
  const integrityFailure = source.failure();

  if (Option.isSome(integrityFailure)) {
    return Result.fail(integrityFailure.value);
  }

  if (written.status === PromiseSettlement.Rejected) {
    const reason = String(written.reason);
    const failure = new EvidenceStorageFailed({ artifactId: owner.artifactId, reason });

    return Result.fail(failure);
  }

  return Result.succeed(undefined);
}

async function verifyEvidenceChunks({ bucket, descriptor, chunks, ...owner }: CommitInput): Promise<CommitResult> {
  const source = evidenceChunkStream({ bucket, chunks, ...owner });
  const digest = new crypto.DigestStream('SHA-256');
  const hashing = source.stream.pipeTo(digest);
  const [hashed, checksum] = await Promise.allSettled([hashing, digest.digest]);
  const integrityFailure = source.failure();

  if (Option.isSome(integrityFailure)) {
    return Result.fail(integrityFailure.value);
  }

  if (hashed.status === PromiseSettlement.Rejected) {
    const reason = String(hashed.reason);
    const failure = new EvidenceStorageFailed({ artifactId: owner.artifactId, reason });

    return Result.fail(failure);
  }

  if (checksum.status === PromiseSettlement.Rejected) {
    const reason = String(checksum.reason);
    const failure = new EvidenceStorageFailed({ artifactId: owner.artifactId, reason });

    return Result.fail(failure);
  }

  const sizeBytes = Number(digest.bytesWritten);

  if (sizeBytes !== descriptor.sizeBytes) {
    const failure = new EvidenceIntegrityFailed({
      artifactId: owner.artifactId,
      reason: EvidenceIntegrityReason.SizeMismatch,
    });

    return Result.fail(failure);
  }

  const digestBytes = new Uint8Array(checksum.value);
  const sha256 = Hex.encode(digestBytes);

  if (sha256 !== descriptor.sha256) {
    const failure = new EvidenceIntegrityFailed({
      artifactId: owner.artifactId,
      reason: EvidenceIntegrityReason.DigestMismatch,
    });

    return Result.fail(failure);
  }

  return Result.succeed(undefined);
}

type ChunkStreamInput = ObjectInput & Pick<CommitInput, 'chunks'>;

type EvidenceStream = {
  readonly stream: ReadableStream<Uint8Array>;
  readonly failure: () => Option.Option<EvidenceIntegrityFailed>;
};

function evidenceChunkStream({ bucket, chunks, ...owner }: ChunkStreamInput): EvidenceStream {
  const pending = chunks[Symbol.iterator]();
  let failure: Option.Option<EvidenceIntegrityFailed> = Option.none();

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller): Promise<void> {
      const next = pending.next();

      if (next.done === true) {
        controller.close();

        return;
      }

      const chunk = next.value;
      const read = await readEvidenceChunk({ bucket, chunk, ...owner });

      if (Result.isFailure(read)) {
        failure = Option.some(read.failure);

        controller.error(read.failure);

        return;
      }

      controller.enqueue(read.success);
    },
  });

  return { stream, failure: () => failure };
}

type ReadChunkInput = ObjectInput & { readonly chunk: EvidenceChunk };

async function readEvidenceChunk({
  bucket,
  chunk,
  ...owner
}: ReadChunkInput): Promise<Result.Result<Uint8Array<ArrayBuffer>, EvidenceIntegrityFailed>> {
  const isInvalidSize = chunk.sizeBytes === 0 || chunk.sizeBytes > EVIDENCE_CHUNK_MAX_BYTES;

  if (isInvalidSize) {
    const failure = new EvidenceIntegrityFailed({
      artifactId: owner.artifactId,
      reason: EvidenceIntegrityReason.ChunkMismatch,
    });

    return Result.fail(failure);
  }

  const key = evidenceChunkKey({ ...owner, offsetBytes: chunk.offsetBytes });
  const stored = await bucket.get(key);
  const object = Option.fromNullishOr(stored);

  if (Option.isNone(object)) {
    const failure = new EvidenceIntegrityFailed({
      artifactId: owner.artifactId,
      reason: EvidenceIntegrityReason.ChunkMissing,
    });

    return Result.fail(failure);
  }

  if (object.value.size !== chunk.sizeBytes) {
    const failure = new EvidenceIntegrityFailed({
      artifactId: owner.artifactId,
      reason: EvidenceIntegrityReason.ChunkMismatch,
    });

    return Result.fail(failure);
  }

  const bytes = await object.value.arrayBuffer();
  const chunkBytes = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest('SHA-256', chunkBytes);
  const digestBytes = new Uint8Array(digest);
  const sha256 = Hex.encode(digestBytes);

  if (chunkBytes.byteLength !== chunk.sizeBytes || sha256 !== chunk.sha256) {
    const failure = new EvidenceIntegrityFailed({
      artifactId: owner.artifactId,
      reason: EvidenceIntegrityReason.ChunkMismatch,
    });

    return Result.fail(failure);
  }

  return Result.succeed(chunkBytes);
}

type ReleaseInput = Pick<CommitInput, 'chunks'> & { readonly object: ObjectInput };

/** Deletes staging only; callers commit Ready first and retain chunk receipts to retry failed cleanup. */
export async function releaseEvidenceChunks({ object, chunks }: ReleaseInput): Promise<void> {
  const { bucket, ...owner } = object;
  const keys = chunks.map(({ offsetBytes }) => evidenceChunkKey({ ...owner, offsetBytes }));

  if (keys.length > 0) {
    await bucket.delete(keys);
  }
}

/** Reads the admitted owner's private object, returning null when its media is unavailable. */
export async function readEvidenceObject({ bucket, range, ...owner }: ReadInput): Promise<R2ObjectBody | null> {
  const key = evidenceObjectKey(owner);

  return await bucket.get(key, { range });
}
