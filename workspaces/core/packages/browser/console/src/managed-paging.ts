import { useNavigate, useRouterState } from '@tanstack/react-router';
import type { HistoryState } from '@tanstack/react-router';
import { managedDestination } from './managed-navigation.ts';
import type { ConsoleLocation } from './types.ts';

export function useManagedPaging(location: ConsoleLocation, workspaceId: string) {
  const navigate = useNavigate();
  const trail = useRouterState({ select: (state) => state.location.state.managedPages });
  const page = location.page ?? null;

  function open(cursor: string | null, pages: ReadonlyArray<string | null>): void {
    function state(prior: HistoryState): HistoryState {
      const origin = prior.sessionReaderOrigin;

      if (location.isSessionEvidence === true && origin !== undefined) {
        return { managedPages: pages, sessionReaderOrigin: { ...origin, steps: origin.steps + 1 } };
      }

      return { managedPages: pages };
    }

    if (location.isArchiveIndex === true) {
      void navigate({
        to: '/workspaces/$workspaceId/archives',
        params: { workspaceId },
        search: cursor === null ? {} : { page: cursor },
        state,
      });
    } else if (location.agent === undefined) {
      void navigate({
        to: '/',
        search: { workspace: workspaceId, ...(cursor === null ? {} : { page: cursor }) },
        state,
      });
    } else {
      void navigate({
        ...managedDestination({
          workspace: workspaceId,
          agent: location.agent,
          ...(location.session === undefined ? {} : { session: location.session }),
          ...(location.isSessionEvidence === true ? { isSessionEvidence: true } : {}),
          ...(location.thread === undefined ? {} : { thread: location.thread }),
          ...(location.through === undefined ? {} : { through: location.through }),
          ...(location.eventId === undefined ? {} : { eventId: location.eventId }),
          ...(cursor === null ? {} : { page: cursor }),
        }),
        state,
      });
    }
  }

  return {
    previous: page === null ? undefined : () => open(trail?.at(-1) ?? null, trail?.slice(0, -1) ?? []),
    next: (cursor: string | null) => (cursor === null ? undefined : () => open(cursor, [...(trail ?? []), page])),
  };
}
