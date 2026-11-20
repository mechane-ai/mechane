import { SANDBOX_SERVICE_PREFIX } from '@mechane/sandbox-wire';
import type { EvidencePath } from './schemas.ts';

/** Media is streamed through the authenticated service, never a public bucket URL. */
export function sandboxEvidenceContentPath({ workspaceId, mechId, artifactId }: EvidencePath): string {
  return `${SANDBOX_SERVICE_PREFIX}/${encodeURIComponent(workspaceId)}/${encodeURIComponent(mechId)}/evidence/${encodeURIComponent(artifactId)}/content`;
}
