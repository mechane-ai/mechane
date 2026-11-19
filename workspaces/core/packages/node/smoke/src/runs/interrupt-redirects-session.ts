import { createManagedContext, requireFixtures } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { message, waitForReply, whileModelIsHeld } from './session-messages.ts';

export async function interruptRedirectsSession({ stack }: ScenarioInput): Promise<void> {
  const { model } = requireFixtures(stack);
  const first = randomUUID();
  const redirected = randomUUID();
  const reply = randomUUID();
  const tool = 'record_change';

  const context = await createManagedContext({
    stack,
    name: first,
    agent: {
      tools: [{ type: 'custom', name: tool, description: 'Record the change', input_schema: { type: 'object' } }],
    },
  });

  model.configure({ marker: first, replies: [{ isHeld: true, tools: [{ id: randomUUID(), name: tool, input: {} }] }] });
  model.configure({ marker: redirected, replies: [{ text: reply }] });

  const events = context.client.beta.sessions.events;
  const id = context.session.id;

  await whileModelIsHeld(context, first, async () => {
    await events.send(id, { events: [{ type: 'user.interrupt' }, message(redirected)] });
    await waitForReply(context, reply);
  });

  const history = [];

  for await (const event of events.list(id, { order: 'asc' })) {
    history.push(event);
  }

  assert.ok(
    !history.some((event) => event.type === 'agent.custom_tool_use'),
    'The tool call from the interrupted model request escaped to the client',
  );

  const interrupt = history.findIndex(
    (event) => event.type === 'user.interrupt' && typeof event.processed_at === 'string',
  );

  const stopped = history.findIndex(
    (event, index) =>
      index > interrupt && event.type === 'session.status_idle' && event.stop_reason.type === 'end_turn',
  );

  const continued = history.findIndex((event, index) => index > stopped && event.type === 'session.status_running');

  assert.ok(
    interrupt !== -1 && stopped > interrupt && continued > stopped,
    'A redirect must finish the interrupted turn before starting the replacement',
  );
}
