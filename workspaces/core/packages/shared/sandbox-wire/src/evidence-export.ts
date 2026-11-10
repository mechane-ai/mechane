import { Bytes, EvidenceArtifactId, MachineId, MediaType, RecordText, SHA256_PATTERN } from '@mechane/records';
import type { RecordId } from '@mechane/records';
import { Schema } from 'effect';
import { SANDBOX_SERVICE_PREFIX, SandboxServiceIdentity } from './service.ts';

export const EvidenceExportIdentity = Schema.Struct({
  ...SandboxServiceIdentity.fields,
  artifactId: EvidenceArtifactId,
});

export type EvidenceExportIdentity = typeof EvidenceExportIdentity.Type;

/** Transfers a fixed capture rather than a caller-selected file or download URL. */
export const EvidenceExportMetadata = Schema.Struct({
  artifactId: EvidenceArtifactId,
  sha256: Schema.String.check(Schema.isPattern(SHA256_PATTERN)),
  sizeBytes: Bytes.check(Schema.isGreaterThan(0)),
  mediaType: Schema.Literals([MediaType.Png, MediaType.Jpeg, MediaType.Mp4]),
});

export type EvidenceExportMetadata = typeof EvidenceExportMetadata.Type;

export const EvidenceExportFile = Schema.Struct({ ...EvidenceExportMetadata.fields, path: RecordText });

export type EvidenceExportFile = typeof EvidenceExportFile.Type;

export const EvidenceExportResult = Schema.TaggedUnion({
  Pending: { reason: RecordText },
  Ready: { machineId: MachineId, file: EvidenceExportFile },
  Failed: { reason: RecordText },
});

export type EvidenceExportResult = typeof EvidenceExportResult.Type;

export function sandboxEvidenceExportPath({ workspaceId, mechId, artifactId }: EvidenceExportIdentity): string {
  const workspace = encodeURIComponent(workspaceId);
  const mech = encodeURIComponent(mechId);
  const artifact = encodeURIComponent(artifactId);

  return `${SANDBOX_SERVICE_PREFIX}/${workspace}/${mech}/evidence/${artifact}/export`;
}

type GuestExportPathInput = { readonly machineId: RecordId; readonly metadata: EvidenceExportMetadata };

export function guestEvidenceExportPath({ machineId, metadata }: GuestExportPathInput): string {
  const machine = encodeURIComponent(machineId);
  const artifact = encodeURIComponent(metadata.artifactId);
  const sizeBytes = String(metadata.sizeBytes);

  const parameters = new URLSearchParams({ sha256: metadata.sha256, sizeBytes, mediaType: metadata.mediaType });

  return `/machines/${machine}/evidence/${artifact}?${parameters}`;
}
