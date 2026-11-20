import { createAgentSlotClient } from '@mechane/agent-slot';
import type { ManagedRequest } from './types.ts';

type Attention = Pick<ManagedRequest, 'scope' | 'store' | 'slots'> & { readonly agentId: string };

function visibleActiveSession(
  activeId: string | null,
  visible: ReadonlyMap<string, string | null>,
): { readonly sessionId: string | null; readonly sessionTitle: string | null } {
  if (activeId !== null && visible.has(activeId)) {
    return { sessionId: activeId, sessionTitle: visible.get(activeId) ?? null };
  }

  return { sessionId: null, sessionTitle: null };
}

export async function agentAttention({ scope, store, slots, agentId }: Attention) {
  await store.managed.agents.get({ scope, id: agentId });

  const active = await createAgentSlotClient({
    namespace: slots,
    scope: { workspaceId: scope.workspaceId, agentId },
  }).attention();

  const ids = [...active.queuedSessionIds];

  if (active.sessionId !== null) {
    ids.push(active.sessionId);
  }

  if (ids.length === 0) {
    return { sessionId: null, sessionTitle: null, queuedSessionIds: [] };
  }

  const summaries = await store.managed.sessions.visibleSummaries({ scope, ids });
  const visible = new Map(summaries.map((summary) => [summary.id, summary.title]));
  const current = visibleActiveSession(active.sessionId, visible);

  return { ...current, queuedSessionIds: active.queuedSessionIds.filter((id) => visible.has(id)) };
}
