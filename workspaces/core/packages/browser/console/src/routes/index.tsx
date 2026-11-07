import { ConsoleView } from '@mechane/protocol';
import { createFileRoute } from '@tanstack/react-router';
import { Schema } from 'effect';
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
  component: () => null,
});
