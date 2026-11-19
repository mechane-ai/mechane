import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/workspaces/$workspaceId/archives')({
  validateSearch: (search: Record<string, unknown>) =>
    typeof search['page'] === 'string' ? { page: search['page'] } : {},
  head: () => ({ meta: [{ title: 'Archives · Mechane Console' }] }),
  component: () => null,
});
