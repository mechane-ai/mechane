import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/workspaces/$workspaceId/mechs/$mechId/evidence/$artifactId')({
  head: () => ({ meta: [{ title: 'Evidence · Mechane Console' }] }),
  component: () => null,
});
