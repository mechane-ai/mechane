import { SANDBOX_SERVICE_PREFIX } from '@mechane/sandbox-wire';
import type { SandboxServiceIdentity } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { EvidenceQuery } from './schemas.ts';
import type { EvidencePath } from './schemas.ts';

type EvidenceListPathInput = SandboxServiceIdentity & EvidenceQuery;

function evidenceListQuery({ after, turnId }: EvidenceQuery): string {
  const query = Schema.encodeSync(EvidenceQuery)({ after, turnId });
  const parameters = new URLSearchParams(query);
  const text = parameters.toString();

  if (text.length === 0) {
    return '';
  }

  return `?${text}`;
}

/** Private service routes are called only after the Node runtime admits the workspace member. */
export function sandboxEvidenceListPath({ workspaceId, mechId, after, turnId }: EvidenceListPathInput): string {
  const query = evidenceListQuery({ after, turnId });

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
