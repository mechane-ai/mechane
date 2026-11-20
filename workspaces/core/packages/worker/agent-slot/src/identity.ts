import type { AgentSlotScope, SlotNamespace } from './protocol.ts';

export const AGENT_SLOT_URL = 'https://agent-slot.internal/slot';
export const SESSION_SLOT_WAKE_URL = 'https://session.internal/slot-wake';

type SessionNameInput = { readonly workspaceId: string; readonly id: string };

type AddressOwnershipInput = {
  readonly state: Pick<DurableObjectState, 'id'>;
  readonly slots: SlotNamespace;
  readonly scope: AgentSlotScope;
};

export function agentSlotName({ workspaceId, agentId }: AgentSlotScope): string {
  return `slot/${encodeURIComponent(workspaceId)}/${encodeURIComponent(agentId)}`;
}

export function managedSessionName({ workspaceId, id }: SessionNameInput): string {
  return `session/${encodeURIComponent(workspaceId)}/${encodeURIComponent(id)}`;
}

export function ownsAgentSlotAddress({ state, slots, scope }: AddressOwnershipInput): boolean {
  const expectedId = slots.idFromName(agentSlotName(scope));

  return state.id.equals(expectedId);
}
