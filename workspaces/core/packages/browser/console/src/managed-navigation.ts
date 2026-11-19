import type { ConsoleLocation } from './types.ts';

export function managedDestination({
  workspace,
  agent,
  session,
  isSessionEvidence,
  artifact,
  thread,
  page,
  through,
  eventId,
}: ConsoleLocation & { readonly workspace: string; readonly agent: string }) {
  const search = {
    ...(thread === undefined ? {} : { thread }),
    ...(page === undefined ? {} : { page }),
    ...(through === undefined ? {} : { through }),
    ...(eventId === undefined ? {} : { eventId }),
  };

  if (session === undefined) {
    return {
      to: '/workspaces/$workspaceId/agents/$agentId' as const,
      params: { workspaceId: workspace, agentId: agent },
      search,
    };
  }

  const params = { workspaceId: workspace, agentId: agent, sessionId: session };

  if (isSessionEvidence === true) {
    return artifact === undefined
      ? { to: '/workspaces/$workspaceId/agents/$agentId/sessions/$sessionId/evidence' as const, params, search }
      : {
          to: '/workspaces/$workspaceId/agents/$agentId/sessions/$sessionId/evidence/$artifactId' as const,
          params: { ...params, artifactId: artifact },
          search,
        };
  }

  return { to: '/workspaces/$workspaceId/agents/$agentId/sessions/$sessionId' as const, params, search };
}

/** Each nested path determines its agent and session; query parameters select only the view within that path. */
export function managedSearch(
  search: Readonly<Record<string, unknown>>,
): Pick<ConsoleLocation, 'thread' | 'page' | 'through' | 'eventId'> {
  return {
    ...(typeof search['thread'] === 'string' ? { thread: search['thread'] } : {}),
    ...(typeof search['through'] === 'string' && Number.isFinite(Date.parse(search['through']))
      ? { through: search['through'] }
      : {}),
    ...(typeof search['eventId'] === 'string' ? { eventId: search['eventId'] } : {}),
    ...(typeof search['page'] === 'string' ? { page: search['page'] } : {}),
  };
}
