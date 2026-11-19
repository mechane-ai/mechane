import { createManagedAgentRuntime } from '@mechane/runtime';
import type { ManagedRequest } from './types.ts';

type Attention = Pick<ManagedRequest, 'scope' | 'store' | 'actors'> & { readonly agentId: string };

export async function agentAttention({ scope, store, actors, agentId }: Attention) {
  await store.managed.agents.get({ scope, id: agentId });

  const active = await createManagedAgentRuntime(actors, { workspaceId: scope.workspaceId, agentId }).attention();
  const ids = [...active.queuedSessionIds];

  if (active.sessionId !== null) {
    ids.push(active.sessionId);
  }

  if (ids.length === 0) {
    return { sessionId: null, queuedSessionIds: [] };
  }

  const visible = new Set(await store.managed.sessions.visibleIds({ scope, ids }));
  let sessionId = active.sessionId;

  if (sessionId !== null && !visible.has(sessionId)) {
    sessionId = null;
  }

  return { sessionId, queuedSessionIds: active.queuedSessionIds.filter((id) => visible.has(id)) };
}
