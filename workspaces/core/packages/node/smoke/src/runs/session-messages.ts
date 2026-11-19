import type { BetaManagedAgentsUserMessageEventParams } from '@anthropic-ai/sdk/resources/beta/sessions/events';
import { requireFixtures, waitFor } from '@mechane/testing';
import type { ManagedContext } from '@mechane/testing';

export function message(text: string): BetaManagedAgentsUserMessageEventParams {
  return { type: 'user.message', content: [{ type: 'text', text }] };
}

export async function waitForReply(
  { client, session }: Pick<ManagedContext, 'client' | 'session'>,
  text: string,
): Promise<void> {
  await waitFor({
    name: 'the expected reply in the session history',
    read: () => client.beta.sessions.events.list(session.id, { types: ['agent.message'], order: 'desc' }),
    accept: (page) =>
      page.data.some(
        (event) =>
          event.type === 'agent.message' && event.content.some((part) => part.type === 'text' && part.text === text),
      ),
  });
}

export async function whileModelIsHeld(
  { client, stack, session }: ManagedContext,
  marker: string,
  act: () => Promise<void>,
): Promise<void> {
  const { model } = requireFixtures(stack);

  await client.beta.sessions.events.send(session.id, { events: [message(marker)] });

  try {
    await model.waitForCall({ marker, index: 0 });
    await act();
  } finally {
    model.release({ marker, index: 0 });
  }
}
