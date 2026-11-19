import type { EvidenceArtifactId, ManagedAgentId } from '@mechane/records';
import type { InstalledActionOrigin } from '@mechane/sandbox-wire';

type Session = Pick<typeof InstalledActionOrigin.Encoded, 'workspaceId' | 'sessionId'> & {
  readonly agentId: typeof ManagedAgentId.Encoded;
};

type Artifact = Session & { readonly artifactId: typeof EvidenceArtifactId.Encoded };
type Content = Artifact & { readonly includeContent: boolean };

const PATH = { workspaces: 'workspaces', agents: 'agents', sessions: 'sessions', evidence: 'evidence' } as const;

function evidenceSegments({ workspaceId, agentId, sessionId }: Session): ReadonlyArray<string> {
  return [
    PATH.workspaces,
    encodeURIComponent(workspaceId),
    PATH.agents,
    encodeURIComponent(agentId),
    PATH.sessions,
    encodeURIComponent(sessionId),
    PATH.evidence,
  ];
}

/** Authenticated Console endpoint for a session’s evidence list, a receipt, or its captured bytes. */
export function consoleSessionEvidencePath({ ...input }: Session | Artifact | Content): string {
  const parts = ['', 'console-api', ...evidenceSegments(input)];

  if ('artifactId' in input) {
    const artifactId = encodeURIComponent(input.artifactId);

    parts.push(artifactId);
  }

  if ('includeContent' in input && input.includeContent) {
    parts.push('content');
  }

  return parts.join('/');
}

/** Human reviewer link that retains the owning workspace, agent, and session through sign-in. */
export function consoleSessionEvidenceViewerPath({ artifactId, ...session }: Artifact): string {
  const parts = ['', 'console', ...evidenceSegments(session), encodeURIComponent(artifactId)];

  return parts.join('/');
}
