/**
 * Cloudflare loads this class through the application Worker's AGENT_SLOTS Durable Object binding.
 *
 * @public
 */
export { AgentSlotObject } from './agent-slot-object.ts';
export { createAgentSlotClient } from './client.ts';
export { managedSessionName, SESSION_SLOT_WAKE_URL } from './identity.ts';
export type { ManagedIdentitySlot, SlotNamespace } from './protocol.ts';
