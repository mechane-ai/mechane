import { createFileRoute } from '@tanstack/react-router';
import { managedSearch } from '../managed-navigation.ts';

export const Route = createFileRoute(
  '/workspaces/$workspaceId/agents/$agentId/sessions/$sessionId/evidence/$artifactId',
)({
  validateSearch: managedSearch,
  head: () => ({ meta: [{ title: 'Evidence · Mechane Console' }] }),
  component: () => null,
});
