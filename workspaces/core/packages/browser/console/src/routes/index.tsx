import { ConsoleView } from '@mechane/protocol';
import { createFileRoute } from '@tanstack/react-router';
import { Schema } from 'effect';
import { tableSearch } from '../managed-navigation.ts';
import type { ConsoleLocation } from '../types.ts';

const isConsoleView = Schema.is(Schema.Enum(ConsoleView));

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): ConsoleLocation => ({
    ...tableSearch(search),
    ...(typeof search['workspace'] === 'string' ? { workspace: search['workspace'] } : {}),
    ...(typeof search['page'] === 'string' ? { page: search['page'] } : {}),
    ...(typeof search['mech'] === 'string' ? { mech: search['mech'] } : {}),
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
