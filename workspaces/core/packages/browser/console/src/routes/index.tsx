import { ConsoleView } from '@mechane/protocol';
import { createFileRoute } from '@tanstack/react-router';
import { Schema } from 'effect';
import type { ReactNode } from 'react';
import { ConsoleApplication } from '../application.tsx';
import { consoleTransition } from '../navigation.tsx';
import type { ConsoleLocation } from '../types.ts';

const isConsoleView = Schema.is(Schema.Enum(ConsoleView));

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): ConsoleLocation => ({
    ...(typeof search['workspace'] === 'string' ? { workspace: search['workspace'] } : {}),
    ...(typeof search['mech'] === 'string' ? { mech: search['mech'] } : {}),
    ...(typeof search['session'] === 'string' ? { session: search['session'] } : {}),
    ...(typeof search['turn'] === 'string' ? { turn: search['turn'] } : {}),
    ...(isConsoleView(search['view']) ? { view: search['view'] } : {}),
    ...(isConsoleView(search['inspect']) ? { inspect: search['inspect'] } : {}),
    ...(typeof search['request'] === 'string' ? { request: search['request'] } : {}),
    ...(typeof search['event'] === 'number' && Number.isSafeInteger(search['event']) && search['event'] > 0
      ? { event: search['event'] }
      : {}),
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
        void navigate({ search, ...consoleTransition(location, search) });
      }}
    />
  );
}
