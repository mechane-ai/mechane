import { readEvidenceViewerPath } from '@mechane/protocol';
import { Outlet, useMatch, useNavigate, useParams, useRouterState } from '@tanstack/react-router';
import { Option } from 'effect';
import type { ReactNode } from 'react';
import { ConsoleApplication } from './application.tsx';
import { managedDestination, managedSearch, tableSearch } from './managed-navigation.ts';
import { consoleTransition } from './navigation.tsx';
import type { ConsoleLocation } from './types.ts';

export function ConsoleRoute(): ReactNode {
  const route = useRouterState({ select: (state) => state.location });
  const navigate = useNavigate();

  const evidenceRoute = useMatch({
    from: '/workspaces/$workspaceId/agents/$agentId/sessions/$sessionId/evidence',
    shouldThrow: false,
  });

  const params = useParams({ strict: false });
  const pathname = new URL(route.publicHref, 'https://console.invalid').pathname;
  const evidence = Option.getOrUndefined(readEvidenceViewerPath({ pathname }));

  if (route.pathname === '/welcome') {
    return <Outlet />;
  }

  function selectedLocation(): ConsoleLocation {
    if (evidence !== undefined) {
      return {
        ...route.state.consoleEvidenceOrigin,
        workspace: evidence.workspaceId,
        mech: evidence.mechId,
        artifact: evidence.artifactId,
      };
    }

    if (params.workspaceId !== undefined && params.agentId === undefined) {
      return {
        workspace: params.workspaceId,
        isArchiveIndex: true,
        ...tableSearch(route.search),
        ...(typeof route.search.page === 'string' ? { page: route.search.page } : {}),
      };
    }

    if (params.workspaceId !== undefined && params.agentId !== undefined) {
      return {
        ...managedSearch(route.search),
        workspace: params.workspaceId,
        agent: params.agentId,
        ...(evidenceRoute === undefined ? {} : { isSessionEvidence: true }),
        ...(params.artifactId === undefined ? {} : { artifact: params.artifactId }),
        ...(params.sessionId === undefined ? {} : { session: params.sessionId }),
      };
    }

    return route.search;
  }

  const location = selectedLocation();

  return (
    <ConsoleApplication
      location={location}
      navigate={(next) => {
        if (next.workspace !== undefined && next.agent !== undefined) {
          void navigate(managedDestination({ ...next, workspace: next.workspace, agent: next.agent }));

          return;
        }

        if (next.artifact !== undefined && next.workspace !== undefined && next.mech !== undefined) {
          void navigate({
            to: '/workspaces/$workspaceId/mechs/$mechId/evidence/$artifactId',
            params: { workspaceId: next.workspace, mechId: next.mech, artifactId: next.artifact },
            state: (prior) => ({ ...prior, consoleEvidenceOrigin: location }),
          });

          return;
        }

        void navigate({ to: '/', search: next, ...consoleTransition(location, next) });
      }}
    />
  );
}
