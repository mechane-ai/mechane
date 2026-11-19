import { BYTES_PER_MEBIBYTE } from '@mechane/records';
import { createManagedContext, requireFixtures, waitFor } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Schema } from 'effect';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { postLargeChildResult } from './large-child-result.ts';

const RANDOM_INPUT_BYTES = 6 * BYTES_PER_MEBIBYTE;
const Messages = Schema.Array(Schema.Struct({ role: Schema.String, content: Schema.Json }));
const TextBlocks = Schema.Array(Schema.Struct({ type: Schema.Literal('text'), text: Schema.String }));

function textDigest(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export async function largeEventReplays({ stack }: ScenarioInput): Promise<void> {
  const { model } = requireFixtures(stack);
  const marker = randomUUID();
  const payload = randomBytes(RANDOM_INPUT_BYTES).toString('base64');
  const prompt = `${marker}\n${payload}`;
  const expected = textDigest(prompt);

  model.configure({ marker, replies: [{ text: marker }] });

  const context = await createManagedContext({
    stack,
    name: marker,
    session: { initial_events: [{ type: 'user.message', content: [{ type: 'text', text: prompt }] }] },
  });

  const { client, session } = context;
  const call = await model.waitForCall({ marker, index: 0 });
  const messages = Schema.decodeUnknownSync(Messages)(call.body['messages']);
  const user = messages.findLast((message) => message.role === 'user');

  assert.ok(user !== undefined);

  if (typeof user.content === 'string') {
    assert.equal(textDigest(user.content), expected);
  } else {
    const blocks = Schema.decodeUnknownSync(TextBlocks)(user.content);

    assert.equal(blocks.length, 1);

    const [block] = blocks;

    assert.ok(block !== undefined);
    assert.equal(textDigest(block.text), expected);
  }

  await waitFor({
    name: 'the completed large input',
    read: async () => await client.beta.sessions.events.list(session.id, { types: ['agent.message'] }),
    accept: (page) =>
      page.data.some(
        (event) =>
          event.type === 'agent.message' && event.content.some((part) => part.type === 'text' && part.text === marker),
      ),
  });

  async function replay() {
    const page = await client.beta.sessions.events.list(session.id, { types: ['user.message'] });
    const [event] = page.data;

    assert.equal(page.data.length, 1);
    assert.equal(page.next_page, null);
    assert.ok(event?.type === 'user.message');

    const [block] = event.content;

    assert.ok(block?.type === 'text');
    assert.equal(event.content.length, 1);
    assert.equal(textDigest(block.text), expected);

    return event.id;
  }

  const originalId = await replay();
  const verifyChildResult = await postLargeChildResult(context, payload);

  await stack.restart();
  assert.equal(await replay(), originalId);
  await verifyChildResult();
}
