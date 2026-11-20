import { Outlet, useMatch, useNavigate, useParams, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { ConsoleApplication } from './application.tsx';
import { managedDestination, managedSearch } from './managed-navigation.ts';
import type { ConsoleLocation } from './types.ts';

export function ConsoleRoute(): ReactNode {
  const route = useRouterState({ select: (state) => state.location });
  const navigate = useNavigate();

  const evidenceRoute = useMatch({
    from: '/workspaces/$workspaceId/agents/$agentId/sessions/$sessionId/evidence',
    shouldThrow: false,
  });

  const params = useParams({ strict: false });

  if (route.pathname === '/welcome') {
    return <Outlet />;
  }

  function selectedLocation(): ConsoleLocation {
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

        void navigate({ to: '/', search: next });
      }}
    />
  );
}
