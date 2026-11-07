import { EvidenceStatus } from '@mechane/protocol';
import type { EvidenceArtifact } from '@mechane/protocol';
import { releaseEvidenceChunks } from '@mechane/sandbox-store';
import type { SandboxStore } from '@mechane/sandbox-store';
import { capturePromise } from '@mechane/utilities';
import { Result } from 'effect';

type CleanupInput = { readonly store: SandboxStore; readonly bucket: R2Bucket; readonly artifact: EvidenceArtifact };

/** Failed staging cleanup leaves Ready media readable and durable receipts available for another attempt. */
export async function cleanupReadyEvidence({ store, bucket, artifact }: CleanupInput): Promise<void> {
  if (artifact.status !== EvidenceStatus.Ready) {
    return;
  }

  const chunks = store.evidenceChunks({ artifactId: artifact.artifactId });
  const object = { bucket, ...artifact };
  const promise = releaseEvidenceChunks({ object, chunks });
  const cleanup = await capturePromise({ promise });

  if (Result.isFailure(cleanup)) {
    const line = JSON.stringify({
      event: 'evidence_cleanup_failed',
      artifactId: artifact.artifactId,
      error: 'EvidenceChunkReleaseFailed',
    });

    console.error(line);
  }
}
