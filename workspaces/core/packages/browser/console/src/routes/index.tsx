import { createFileRoute } from '@tanstack/react-router';
import { tableSearch } from '../managed-navigation.ts';
import type { ConsoleLocation } from '../types.ts';

const SETTINGS_VIEW = 'definition';
const FILES_VIEW = 'files';

function viewSearch(value: unknown): Pick<ConsoleLocation, 'view'> {
  switch (value) {
    case SETTINGS_VIEW:
    case FILES_VIEW:
      return { view: value };

    default:
      return {};
  }
}

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): ConsoleLocation => ({
    ...tableSearch(search),
    ...(typeof search['workspace'] === 'string' ? { workspace: search['workspace'] } : {}),
    ...(typeof search['page'] === 'string' ? { page: search['page'] } : {}),
    ...viewSearch(search['view']),
  }),
  component: () => null,
});
