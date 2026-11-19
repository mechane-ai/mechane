import { APIConnectionError } from '@anthropic-ai/sdk';
import type {
  BetaManagedAgentsUserCustomToolResultEvent,
  BetaManagedAgentsUserCustomToolResultEventParams,
} from '@anthropic-ai/sdk/resources/beta/sessions/events';
import { requireFixtures, waitFor } from '@mechane/testing';
import type { ManagedContext } from '@mechane/testing';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';

export async function postLargeChildResult(context: ManagedContext, payload: string) {
  const { model } = requireFixtures(context.stack);
  const { agents, sessions } = context.client.beta;
  const key = randomUUID();

  const child = await agents.create({
    name: `receipt-reader-${key}`,
    model: context.agent.model.id,
    tools: [
      {
        type: 'custom',
        name: 'read_receipt',
        description: 'Read the requested receipt.',
        input_schema: { type: 'object' },
      },
    ],
  });

  const parent = await agents.create({
    name: `coordinator-${key}`,
    model: context.agent.model.id,
    multiagent: { type: 'coordinator', agents: [{ type: 'agent', id: child.id, version: child.version }] },
  });

  const session = await sessions.create({ agent: parent.id, environment_id: context.environment.id });
  const request = `Request receipt ${key}`;
  const task = `Read receipt ${key}`;
  const report = `Receipt read ${key}`;

  const delegation = { name: 'delegate_to_agent', input: { agent_id: child.id, message: task }, id: randomUUID() };

  model.configure({ marker: request, replies: [{ tools: [delegation] }, { text: 'Waiting for the receipt.' }] });
  model.configure({
    marker: task,
    replies: [{ tools: [{ id: randomUUID(), name: 'read_receipt', input: {} }] }, { text: report }],
  });
  model.configure({ marker: report, replies: [{ text: `Confirmed ${key}` }] });
  await sessions.events.send(session.id, {
    events: [{ type: 'user.message', content: [{ type: 'text', text: request }] }],
  });

  const pending = await waitFor({
    name: 'the delegated receipt reader to request its tool',
    read: async () => await sessions.events.list(session.id, { types: ['agent.custom_tool_use'] }),
    accept: (page) =>
      page.data.some((event) => event.type === 'agent.custom_tool_use' && event.name === 'read_receipt'),
  });

  const use = pending.data.find((event) => event.type === 'agent.custom_tool_use' && event.name === 'read_receipt');

  assert.ok(use?.type === 'agent.custom_tool_use' && typeof use.session_thread_id === 'string');

  const threadId = use.session_thread_id;
  const callId = use.id;

  const result: BetaManagedAgentsUserCustomToolResultEventParams = {
    type: 'user.custom_tool_result',
    custom_tool_use_id: use.id,
    content: [{ type: 'text', text: payload }],
  };

  const expected = createHash('sha256').update(payload).digest('hex');

  const lost = new Error('The client lost the successful tool result acknowledgement');

  const disconnected = context.client.withOptions({
    maxRetries: 0,
    fetch: async (input, options) => {
      const response = await fetch(input, options);

      if (!response.ok) {
        return response;
      }

      await response.body?.cancel();

      throw lost;
    },
  });

  await assert.rejects(
    disconnected.beta.sessions.events.send(session.id, { events: [result] }),
    (error) => error instanceof APIConnectionError && error.cause === lost,
  );

  function checkResult(event: BetaManagedAgentsUserCustomToolResultEvent | undefined) {
    assert.ok(event !== undefined);
    assert.equal(event.custom_tool_use_id, callId);

    const block = event.content?.[0];

    assert.ok(block?.type === 'text');
    assert.equal(createHash('sha256').update(block.text).digest('hex'), expected);

    return event.id;
  }

  return async function verifyAfterRestart() {
    const retried = await sessions.events.send(session.id, { events: [result] });
    const first = retried.data?.[0];

    assert.ok(first?.type === 'user.custom_tool_result');

    const wanted = checkResult(first);

    await waitFor({
      name: 'the coordinator to receive the completed child report',
      read: async () => await sessions.events.list(session.id, { types: ['agent.thread_message_received'] }),
      accept: (page) =>
        page.data.some(
          (event) =>
            event.type === 'agent.thread_message_received' &&
            event.from_session_thread_id === threadId &&
            event.content.some((block) => block.type === 'text' && block.text === report),
        ),
    });

    const rootIds: Array<string> = [];

    for await (const event of sessions.events.list(session.id, { types: ['user.custom_tool_result'] })) {
      assert.ok(event.type === 'user.custom_tool_result');
      rootIds.push(checkResult(event));
    }

    const childIds: Array<string> = [];

    for await (const event of sessions.threads.events.list(threadId, { session_id: session.id })) {
      if (event.type === 'user.custom_tool_result') {
        childIds.push(checkResult(event));
      }
    }

    assert.deepEqual(rootIds, [wanted]);
    assert.deepEqual(childIds, [wanted]);
  };
}
