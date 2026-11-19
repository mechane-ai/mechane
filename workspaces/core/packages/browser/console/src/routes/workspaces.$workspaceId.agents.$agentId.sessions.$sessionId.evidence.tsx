import { createFileRoute } from '@tanstack/react-router';
import { managedSearch } from '../managed-navigation.ts';

export const Route = createFileRoute('/workspaces/$workspaceId/agents/$agentId/sessions/$sessionId/evidence')({
  validateSearch: managedSearch,
  head: () => ({ meta: [{ title: 'Session evidence · Mechane Console' }] }),
  component: () => null,
});
