import { createFileRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { ConsoleApplication } from '../application.tsx';
import type { ConsoleLocation } from '../types.ts';

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): ConsoleLocation => ({
    ...(typeof search['workspace'] === 'string' ? { workspace: search['workspace'] } : {}),
    ...(typeof search['mech'] === 'string' ? { mech: search['mech'] } : {}),
    ...(typeof search['turn'] === 'string' ? { turn: search['turn'] } : {}),
  }),
  component: ConsoleRoute,
});

function ConsoleRoute(): ReactNode {
  const location = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <ConsoleApplication
      location={location}
      navigate={(search) => {
        void navigate({ search });
      }}
    />
  );
}
