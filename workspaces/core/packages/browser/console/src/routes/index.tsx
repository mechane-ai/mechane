import { createFileRoute } from '@tanstack/react-router';
import { tableSearch } from '../managed-navigation.ts';
import type { ConsoleLocation } from '../types.ts';

const SETTINGS_VIEW = 'definition';

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): ConsoleLocation => ({
    ...tableSearch(search),
    ...(typeof search['workspace'] === 'string' ? { workspace: search['workspace'] } : {}),
    ...(typeof search['page'] === 'string' ? { page: search['page'] } : {}),
    ...(search['view'] === SETTINGS_VIEW ? { view: SETTINGS_VIEW } : {}),
  }),
  component: () => null,
});
