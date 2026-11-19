import { createManagedContext, requireFixtures } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { message, waitForReply, whileModelIsHeld } from '../runs/session-messages.ts';

const providerMessages = Schema.decodeUnknownSync(
  Schema.Array(Schema.Struct({ role: Schema.String, content: Schema.Json })),
);

export async function queuedInputKeepsSessionContext({ stack }: ScenarioInput): Promise<void> {
  const { model } = requireFixtures(stack);
  const first = randomUUID();
  const queued = randomUUID();
  const followup = randomUUID();
  const firstAnswer = randomUUID();
  const queuedAnswer = randomUUID();
  const finalAnswer = randomUUID();
  const instruction = `Report measurements in kelvin. ${randomUUID()}`;

  model.configure({ marker: first, replies: [{ text: firstAnswer, isHeld: true }] });
  model.configure({ marker: queued, replies: [{ text: queuedAnswer }] });
  model.configure({ marker: followup, replies: [{ text: finalAnswer }] });

  const context = await createManagedContext({ stack, name: first });
  const events = context.client.beta.sessions.events;
  const id = context.session.id;

  await whileModelIsHeld(context, first, async () => {
    const received = await events.send(id, {
      events: [message(queued), { type: 'system.message', content: [{ type: 'text', text: instruction }] }],
    });

    const input = received.data?.[0];

    assert.equal(received.data?.[1]?.type, 'system.message');
    assert.ok(input?.type === 'user.message' && input.processed_at === null);
    assert.equal(model.readCalls({ marker: queued }).length, 0);
  });

  await waitForReply(context, queuedAnswer);
  await stack.restart({ signal: 'SIGKILL' });

  await events.send(id, { events: [message(followup)] });
  await waitForReply(context, finalAnswer);

  const continued = model.readCalls({ marker: followup });

  assert.equal(continued.length, 1);

  const messages = providerMessages(continued[0]?.body['messages']);
  const update = messages.findIndex((entry) => entry.role === 'system' && entry.content === instruction);

  const queuedResponse = messages.findIndex(
    (entry) => entry.role === 'assistant' && JSON.stringify(entry.content).includes(queuedAnswer),
  );

  const queuedInput = messages.findIndex(
    (entry) => entry.role === 'user' && JSON.stringify(entry.content).includes(queued),
  );

  assert.ok(
    queuedInput !== -1 && queuedInput < update && update < queuedResponse,
    'System context lost its role or position after restart',
  );
  assert.equal(messages.filter((entry) => entry.content === instruction).length, 1);

  const transcript = JSON.stringify(messages);

  assert.ok(
    transcript.includes(firstAnswer) && transcript.includes(queuedAnswer),
    'The provider lost earlier turns from this session after restart',
  );
  assert.equal(model.readCalls({ marker: first }).length, 1);
  assert.equal(model.readCalls({ marker: queued }).length, 1);
}
