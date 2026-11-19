import { createFileRoute } from '@tanstack/react-router';
import { managedSearch } from '../managed-navigation.ts';

export const Route = createFileRoute('/workspaces/$workspaceId/agents/$agentId/sessions/$sessionId')({
  validateSearch: managedSearch,
  head: () => ({ meta: [{ title: 'Session · Mechane Console' }] }),
  component: () => null,
});
