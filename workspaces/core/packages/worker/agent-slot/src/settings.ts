import type { AgentSlotBindings, SlotNamespace } from './protocol.ts';

type LoadBindingsInput = { readonly environment: AgentSlotBindings };

export type DecodedAgentSlotBindings = { readonly slots: SlotNamespace; readonly sessions: SlotNamespace };

/** Decodes Durable Object namespaces owned or woken by `AgentSlotObject`. */
export function loadAgentSlotBindings({ environment }: LoadBindingsInput): DecodedAgentSlotBindings {
  return { slots: environment.AGENT_SLOTS, sessions: environment.SESSIONS };
}
