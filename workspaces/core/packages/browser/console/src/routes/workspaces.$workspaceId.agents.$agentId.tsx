import { createFileRoute } from '@tanstack/react-router';
import { managedSearch } from '../managed-navigation.ts';

export const Route = createFileRoute('/workspaces/$workspaceId/agents/$agentId')({
  validateSearch: managedSearch,
  head: () => ({ meta: [{ title: 'Agent sessions · Mechane Console' }] }),
  component: () => null,
});
