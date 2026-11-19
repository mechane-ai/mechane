import type { ManagedAgentScope } from './protocol.ts';

export const managedActorUrl = 'https://mech.internal/managed-agents';

export function managedActorName({ workspaceId, agentId }: ManagedAgentScope): string {
  return `managed/${encodeURIComponent(workspaceId)}/${encodeURIComponent(agentId)}`;
}
