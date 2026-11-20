import { HttpHeader, HttpMethod } from '@mechane/records';
import { SANDBOX_EVIDENCE_HEADERS, SandboxEvidenceMetadata } from '@mechane/sandbox-provider';
import type { SandboxEvidenceKind } from '@mechane/sandbox-provider';
import { Schema } from 'effect';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export type DirectEvidenceUploadInput = {
  readonly apiOrigin: string;
  readonly sessionId: string;
  readonly artifactId: string;
  readonly sessionToken: string;
  readonly filePath: string;
  readonly kind: SandboxEvidenceKind;
  readonly mediaType: string;
  readonly turnId?: string | undefined;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  readonly durationMs?: number | undefined;
  readonly transport?: typeof fetch | undefined;
};

/** Streams a screenshot or recording straight to Mechane's direct R2 evidence endpoint with SHA-256 verification. */
export async function uploadSessionEvidence({
  apiOrigin,
  sessionId,
  artifactId,
  sessionToken,
  filePath,
  kind,
  mediaType,
  turnId,
  width,
  height,
  durationMs,
  transport = fetch,
}: DirectEvidenceUploadInput): Promise<SandboxEvidenceMetadata> {
  const bytes = await readFile(filePath);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const origin = apiOrigin.replace(/\/+$/u, '');
  const url = `${origin}/internal/managed/sessions/${encodeURIComponent(sessionId)}/evidence/${encodeURIComponent(artifactId)}`;

  const headers: Record<string, string> = {
    [HttpHeader.Authorization]: `Bearer ${sessionToken}`,
    [HttpHeader.ContentType]: mediaType,
    [SANDBOX_EVIDENCE_HEADERS.kind]: kind,
    [SANDBOX_EVIDENCE_HEADERS.sha256]: sha256,
  };

  if (turnId !== undefined) {
    headers[SANDBOX_EVIDENCE_HEADERS.turnId] = turnId;
  }

  if (width !== undefined) {
    headers[SANDBOX_EVIDENCE_HEADERS.width] = String(width);
  }

  if (height !== undefined) {
    headers[SANDBOX_EVIDENCE_HEADERS.height] = String(height);
  }

  if (durationMs !== undefined) {
    headers[SANDBOX_EVIDENCE_HEADERS.durationMs] = String(durationMs);
  }

  const response = await transport(url, { method: HttpMethod.Put, headers, body: bytes, redirect: 'error' });

  if (!response.ok) {
    throw new Error(`Direct evidence upload failed with HTTP ${response.status}`);
  }

  return Schema.decodeUnknownSync(SandboxEvidenceMetadata)(await response.json());
}
