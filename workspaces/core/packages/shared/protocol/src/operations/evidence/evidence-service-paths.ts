import { EvidenceQuery, SANDBOX_SERVICE_PREFIX } from '@mechane/sandbox-wire';
import type { SandboxServiceIdentity } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import type { EvidencePath } from './schemas.ts';

type EvidenceListPathInput = SandboxServiceIdentity & EvidenceQuery;

function evidenceListQuery({ ...fields }: EvidenceQuery): string {
  const query = Schema.encodeSync(EvidenceQuery)(fields);
  const parameters = new URLSearchParams(query);

  if (parameters.size === 0) {
    return '';
  }

  return `?${parameters.toString()}`;
}

/** Private service routes are called only after the Node runtime admits the workspace member. */
export function sandboxEvidenceListPath({ workspaceId, mechId, ...fields }: EvidenceListPathInput): string {
  const query = evidenceListQuery(fields);

  return `${SANDBOX_SERVICE_PREFIX}/${encodeURIComponent(workspaceId)}/${encodeURIComponent(mechId)}/evidence${query}`;
}

/** Capture metadata remains within the sandbox's original owner scope. */
export function sandboxEvidenceArtifactPath({ workspaceId, mechId, artifactId }: EvidencePath): string {
  return `${SANDBOX_SERVICE_PREFIX}/${encodeURIComponent(workspaceId)}/${encodeURIComponent(mechId)}/evidence/${encodeURIComponent(artifactId)}`;
}

/** Media is streamed through the authenticated service, never a public bucket URL. */
export function sandboxEvidenceContentPath({ workspaceId, mechId, artifactId }: EvidencePath): string {
  return `${SANDBOX_SERVICE_PREFIX}/${encodeURIComponent(workspaceId)}/${encodeURIComponent(mechId)}/evidence/${encodeURIComponent(artifactId)}/content`;
}
