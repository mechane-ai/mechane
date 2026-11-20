import { readRequests } from '@mechane/console-data';
import type { ManagedSession } from '@mechane/console-data';
import { EvidenceArtifactId } from '@mechane/records';
import { Schema } from 'effect';
import type { ConsoleLocation } from './types.ts';

const isArtifactId = Schema.is(EvidenceArtifactId);

export function sessionEvidenceRead(
  { agentId, sessionId }: { readonly agentId: ManagedSession['agentId']; readonly sessionId: ManagedSession['id'] },
  location: ConsoleLocation,
) {
  if (location.artifact !== undefined) {
    return isArtifactId(location.artifact)
      ? readRequests.sessionArtifact(agentId, sessionId, location.artifact)
      : undefined;
  }

  if (location.page !== undefined && !isArtifactId(location.page)) {
    return;
  }

  return readRequests.sessionEvidence({ agentId, sessionId }, location.page ?? null, location);
}
