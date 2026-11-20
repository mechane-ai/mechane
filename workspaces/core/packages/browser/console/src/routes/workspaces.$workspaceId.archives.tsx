import { createFileRoute } from '@tanstack/react-router';
import { tableSearch } from '../managed-navigation.ts';

export const Route = createFileRoute('/workspaces/$workspaceId/archives')({
  validateSearch: (search: Record<string, unknown>) => ({
    ...tableSearch(search),
    ...(typeof search['page'] === 'string' && { page: search['page'] }),
  }),
  head: () => ({ meta: [{ title: 'Archives · Mechane Console' }] }),
  component: () => null,
});
