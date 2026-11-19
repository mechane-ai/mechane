import type { ManagedContext } from '../managed-context.ts';
import { waitFor } from '../wait-for.ts';

const deletableStatuses: ReadonlySet<string> = new Set(['idle', 'terminated']);

export async function closeInstalledContext({ client, agent, session }: ManagedContext): Promise<void> {
  const sessions = client.beta.sessions;
  const current = await sessions.retrieve(session.id);

  if (!deletableStatuses.has(current.status)) {
    await sessions.events.send(session.id, { events: [{ type: 'user.interrupt' }] });
    await waitFor({
      name: 'the held managed session to stop before deletion',
      read: () => sessions.retrieve(session.id),
      accept: (value) => deletableStatuses.has(value.status),
    });
  }

  await sessions.delete(session.id);
  await client.beta.agents.archive(agent.id);
}
