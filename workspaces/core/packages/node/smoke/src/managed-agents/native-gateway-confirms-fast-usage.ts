import { MediaType } from '@mechane/records';
import { createManagedContext, requireFixtures, waitFor } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const INPUT_TOKENS = 15_000;
const CACHE_CREATION = { ephemeral_5m_input_tokens: 2000, ephemeral_1h_input_tokens: 10_000 } as const;
const OUTPUT_TOKENS = 7;

export async function nativeGatewayConfirmsFastUsage({ stack }: ScenarioInput): Promise<void> {
  const { model } = requireFixtures(stack);
  const first = randomUUID();
  const second = randomUUID();
  const answer = 'Confirmed fast response';

  const document = {
    type: 'document',
    source: {
      type: 'base64',
      media_type: MediaType.Pdf,
      data: Buffer.from(`%PDF-1.7\n% ${first}\n%%EOF`).toString('base64'),
    },
  } as const;

  model.configure({
    marker: first,
    replies: [
      { text: answer, promptTokens: INPUT_TOKENS, completionTokens: OUTPUT_TOKENS, cacheCreation: CACHE_CREATION },
    ],
  });
  model.configure({ marker: second, replies: [{ text: 'Incorrect speed', reportedSpeed: 'standard' }] });

  const { agent, client, environment, session } = await createManagedContext({
    stack,
    name: first,
    agent: { model: { id: 'claude-opus-5-5', speed: 'fast', effort: 'high' } },
    session: { initial_events: [{ type: 'user.message', content: [{ type: 'text', text: first }, document] }] },
  });

  const call = await model.waitForCall({ marker: first, index: 0 });

  assert.partialDeepStrictEqual(call.body, {
    model: 'claude-opus-5-5',
    speed: 'fast',
    output_config: { effort: 'high' },
    messages: [{ role: 'user', content: [document] }],
  });
  await waitFor({
    name: 'confirmed native fast usage and response',
    read: () => client.beta.sessions.events.list(session.id, { types: ['session.usage', 'agent.message'] }),
    accept: (page) =>
      page.data.some((event) => event.type === 'session.usage' && event.usage.input_tokens === INPUT_TOKENS) &&
      page.data.some(
        (event) =>
          event.type === 'agent.message' &&
          event.content.some((block) => block.type === 'text' && block.text === answer),
      ),
  });

  const completed = await client.beta.sessions.retrieve(session.id);

  assert.partialDeepStrictEqual(completed.usage, {
    input_tokens: INPUT_TOKENS,
    output_tokens: OUTPUT_TOKENS,
    cache_creation: CACHE_CREATION,
    list_cost: { amount: '7', currency: 'USD' },
  });

  const downgraded = await client.beta.sessions.create({
    environment_id: environment.id,
    agent: agent.id,
    initial_events: [{ type: 'user.message', content: [{ type: 'text', text: second }] }],
  });

  await waitFor({
    name: 'unconfirmed model speed surfaces a session error',
    read: () => client.beta.sessions.events.list(downgraded.id, { types: ['session.error'] }),
    accept: (page) => page.data.some((event) => event.type === 'session.error'),
  });

  const rejected = await client.beta.sessions.retrieve(downgraded.id);

  assert.equal(rejected.usage.output_tokens, undefined);
  assert.equal(rejected.usage.list_cost, null);

  const spans = await client.beta.sessions.events.list(downgraded.id, { types: ['span.model_request_end'] });

  assert.equal(spans.data.length, 1);
  assert.partialDeepStrictEqual(spans.data[0], { type: 'span.model_request_end', is_error: true });

  const replies = await client.beta.sessions.events.list(downgraded.id, { types: ['agent.message'] });

  assert.deepEqual(replies.data, []);
  assert.equal(model.readCalls({ marker: second }).length, 1);
}
