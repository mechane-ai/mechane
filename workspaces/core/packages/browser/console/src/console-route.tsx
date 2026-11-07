import { readEvidenceViewerPath } from '@mechane/protocol';
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { Option } from 'effect';
import type { ReactNode } from 'react';
import { ConsoleApplication } from './application.tsx';
import { consoleTransition } from './navigation.tsx';
import type { ConsoleLocation } from './types.ts';

export function ConsoleRoute(): ReactNode {
  const route = useRouterState({ select: (state) => state.location });
  const navigate = useNavigate();
  const pathname = new URL(route.publicHref, 'https://console.invalid').pathname;
  const evidence = Option.getOrUndefined(readEvidenceViewerPath({ pathname }));

  if (route.pathname === '/welcome') {
    return <Outlet />;
  }

  const location: ConsoleLocation =
    evidence === undefined
      ? route.search
      : {
          ...route.state.consoleEvidenceOrigin,
          workspace: evidence.workspaceId,
          mech: evidence.mechId,
          artifact: evidence.artifactId,
        };

  return (
    <ConsoleApplication
      location={location}
      navigate={(next) => {
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
