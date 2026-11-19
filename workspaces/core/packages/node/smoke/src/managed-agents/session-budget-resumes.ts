import { HttpStatusCode } from '@mechane/records';
import { createManagedContext, requireFixtures, waitFor } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const BILLED_INPUT_TOKENS = 11_000;
const SECOND_REPLY = 'continued after the budget change';
const EXPECTED_REQUESTS_AFTER_RESUME = 2;
const ONE_CENT = { currency: 'USD', amount: '1' } as const;

export async function sessionBudgetResumes({ stack }: ScenarioInput): Promise<void> {
  const { model } = requireFixtures(stack);
  const marker = randomUUID();
  const tool = 'report';

  model.configure({
    marker,
    replies: [
      {
        tools: [{ id: 'report_fixture', name: tool, input: {} }],
        promptTokens: BILLED_INPUT_TOKENS,
        completionTokens: 1,
      },
      { text: SECOND_REPLY },
    ],
  });

  const budget = { type: 'limit', max_list_cost: ONE_CENT } as const;

  const { client, session } = await createManagedContext({
    stack,
    name: marker,
    agent: { tools: [{ type: 'custom', name: tool, description: 'Get the report', input_schema: { type: 'object' } }] },
    session: { budget, initial_events: [{ type: 'user.message', content: [{ type: 'text', text: marker }] }] },
  });

  const calls = await waitFor({
    name: 'client tool call from the request that reached its session budget',
    read: () => client.beta.sessions.events.list(session.id, { types: ['agent.custom_tool_use'] }),
    accept: (page) => page.data.some((event) => event.type === 'agent.custom_tool_use'),
  });

  const toolUse = calls.data.find((event) => event.type === 'agent.custom_tool_use');

  assert.ok(toolUse !== undefined);
  await client.beta.sessions.events.send(session.id, {
    events: [
      { type: 'user.custom_tool_result', custom_tool_use_id: toolUse.id, content: [{ type: 'text', text: 'ready' }] },
    ],
  });

  const stopped = await waitFor({
    name: 'session pause at its settled list cost',
    read: () => client.beta.sessions.events.list(session.id),
    accept: (page) =>
      page.data.some((event) => event.type === 'session.status_idle' && event.stop_reason.type === 'budget_reached'),
  });

  const idle = stopped.data.findIndex(
    (event) => event.type === 'session.status_idle' && event.stop_reason.type === 'budget_reached',
  );

  const usage = stopped.data[idle - 1];

  assert.ok(usage?.type === 'session.usage', 'Expected usage immediately before the budget pause');
  assert.equal(usage.usage.input_tokens, BILLED_INPUT_TOKENS);
  assert.equal(usage.usage.list_cost?.amount, '1');
  assert.deepEqual(usage.budget, budget);

  const paused = await client.beta.sessions.retrieve(session.id);

  assert.equal(paused.usage.input_tokens, BILLED_INPUT_TOKENS);
  assert.deepEqual(paused.budget, budget);
  await client.beta.sessions.events.send(session.id, { events: [{ type: 'user.interrupt' }] });

  const interrupts = await client.beta.sessions.events.list(session.id, { types: ['user.interrupt'] });

  assert.equal(interrupts.data.length, 0);
  assert.equal(model.readCalls({ marker }).length, 1);
  await assert.rejects(
    client.beta.sessions.events.send(session.id, {
      events: [{ type: 'user.message', content: [{ type: 'text', text: 'start other work' }] }],
    }),
    { status: HttpStatusCode.BadRequest },
  );
  await assert.rejects(client.beta.sessions.update(session.id, { budget }), { status: HttpStatusCode.BadRequest });

  const resumed = await client.beta.sessions.update(session.id, { budget: null });

  assert.equal(resumed.budget, null);

  await waitFor({
    name: 'the existing tool continuation after budget removal',
    read: () => client.beta.sessions.events.list(session.id, { types: ['agent.message'] }),
    accept: (page) =>
      page.data.some(
        (event) =>
          event.type === 'agent.message' &&
          event.content.some((block) => block.type === 'text' && block.text === SECOND_REPLY),
      ),
  });
  assert.equal(model.readCalls({ marker }).length, EXPECTED_REQUESTS_AFTER_RESUME);
  await assert.rejects(client.beta.sessions.update(session.id, { budget }), { status: HttpStatusCode.BadRequest });
}
