import { EvidenceStatus } from '@mechane/protocol';
import type { EvidenceDescriptor, EvidencePath } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode, MediaType } from '@mechane/records';
import type { EvidenceArtifactId } from '@mechane/records';
import { readEvidenceObject } from '@mechane/sandbox-store';
import type { SandboxStore } from '@mechane/sandbox-store';
import { capturePromise } from '@mechane/utilities';
import { Option, Result } from 'effect';
import { cleanupReadyEvidence } from './evidence-cleanup.ts';
import { evidenceContentRangeHeader, evidenceRange, evidenceUnsatisfiedRangeHeader } from './evidence-range.ts';
import { readEvidenceArtifact } from './read-evidence.ts';

type ContentInput = EvidencePath & {
  readonly store: SandboxStore;
  readonly bucket: R2Bucket;
  /** None requests the complete artifact; a header requests one finite byte interval. */
  readonly rangeHeader: Option.Option<string>;
};

type DispositionInput = {
  readonly artifactId: EvidenceArtifactId;
  readonly mediaType: EvidenceDescriptor['mediaType'];
};

function evidenceDispositionHeader({ artifactId, mediaType }: DispositionInput): string {
  const extensions: Readonly<Record<EvidenceDescriptor['mediaType'], string>> = {
    [MediaType.Png]: 'png',
    [MediaType.Jpeg]: 'jpg',
    [MediaType.Mp4]: 'mp4',
  };

  return `inline; filename="${artifactId}.${extensions[mediaType]}"`;
}

/** The authenticated service streams only the bound owner's verified media and never grants access in a URL. */
export async function readEvidenceContent({
  store,
  bucket,
  rangeHeader,
  ...identity
}: ContentInput): Promise<Response> {
  const found = readEvidenceArtifact({ store, ...identity });

  if (Option.isNone(found)) {
    return new Response(null, { status: HttpStatusCode.NotFound });
  }

  const artifact = found.value;

  await cleanupReadyEvidence({ store, bucket, artifact });

  if (artifact.status !== EvidenceStatus.Ready || Option.isNone(artifact.descriptor)) {
    return new Response(null, { status: HttpStatusCode.NotFound });
  }

  const descriptor = artifact.descriptor.value;
  const disposition = evidenceDispositionHeader({ artifactId: artifact.artifactId, mediaType: descriptor.mediaType });

  const headers = new Headers({
    [HttpHeader.ContentType]: descriptor.mediaType,
    [HttpHeader.CacheControl]: 'private, no-store',
    [HttpHeader.XContentTypeOptions]: 'nosniff',
    [HttpHeader.AcceptRanges]: 'bytes',
    [HttpHeader.ContentDisposition]: disposition,
  });

  const reading = evidenceRange({ header: rangeHeader, sizeBytes: descriptor.sizeBytes });

  if (Option.isNone(reading)) {
    const contentRange = evidenceUnsatisfiedRangeHeader({ sizeBytes: descriptor.sizeBytes });

    headers.set(HttpHeader.ContentRange, contentRange);

    return new Response(null, { status: HttpStatusCode.RangeNotSatisfiable, headers });
  }

  const { range, isPartial } = reading.value;

  const promise = readEvidenceObject({ bucket, ...identity, range });
  const read = await capturePromise({ promise });

  if (Result.isFailure(read)) {
    return new Response(null, { status: HttpStatusCode.Unavailable });
  }

  const stored = Option.fromNullishOr(read.success);

  if (Option.isNone(stored)) {
    return new Response(null, { status: HttpStatusCode.NotFound });
  }

  const metadata = Option.fromUndefinedOr(stored.value.customMetadata);
  const hasDigest = Option.exists(metadata, (value) => value['sha256'] === descriptor.sha256);

  if (stored.value.size !== descriptor.sizeBytes || !hasDigest) {
    await stored.value.body.cancel();

    return new Response(null, { status: HttpStatusCode.Unavailable });
  }

  const contentLength = String(range.length);

  headers.set(HttpHeader.ContentLength, contentLength);

  if (isPartial) {
    const contentRange = evidenceContentRangeHeader({ range, sizeBytes: descriptor.sizeBytes });

    headers.set(HttpHeader.ContentRange, contentRange);

    return new Response(stored.value.body, { status: HttpStatusCode.PartialContent, headers });
  }

  return new Response(stored.value.body, { headers });
}
