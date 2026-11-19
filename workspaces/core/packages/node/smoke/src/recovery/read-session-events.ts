import type Anthropic from '@anthropic-ai/sdk';
import type { BetaManagedAgentsSessionEvent, EventListParams } from '@anthropic-ai/sdk/resources/beta/sessions/events';

type SessionEventQuery = { readonly client: Anthropic; readonly id: string; readonly query?: EventListParams };

export async function readSessionEvents({
  client,
  id,
  query,
}: SessionEventQuery): Promise<ReadonlyArray<BetaManagedAgentsSessionEvent>> {
  const history: Array<BetaManagedAgentsSessionEvent> = [];

  for await (const event of client.beta.sessions.events.list(id, query)) {
    history.push(event);
  }

  return history;
}
