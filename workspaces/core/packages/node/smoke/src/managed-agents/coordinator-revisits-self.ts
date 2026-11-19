import Anthropic from '@anthropic-ai/sdk';
import { createAccount, requireFixtures, waitFor } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function coordinatorRevisitsSelf({ stack }: ScenarioInput): Promise<void> {
  const { github, model } = requireFixtures(stack);
  const account = await createAccount({ stack, login: github.users.owner.login });
  const client = new Anthropic({ baseURL: stack.origin.origin, apiKey: account.token, maxRetries: 0 });
  const { agents, environments, sessions } = client.beta;
  const key = randomUUID();

  const agent = await agents.create({
    name: key,
    model: 'claude-haiku-5-5',
    multiagent: { type: 'coordinator', agents: [{ type: 'self' }] },
  });

  const environment = await environments.create({ name: key, config: { type: 'self_hosted' } });
  const session = await sessions.create({ agent: agent.id, environment_id: environment.id });
  const dispatch = `Delegate inspection ${key}`;
  const task = `Inspect amber ${key}`;
  const report = `Amber verified ${key}`;
  const followup = `Continue the existing inspection ${key}`;
  const request = `Recall the earlier inspection ${key}`;
  const secondReport = `Amber still verified ${key}`;

  async function waitForCoordinator(text: string) {
    await waitFor({
      name: `coordinator answered ${text}`,
      read: () => sessions.events.list(session.id, { types: ['agent.message'] }),
      accept: (page) =>
        page.data.some(
          (event) =>
            event.type === 'agent.message' &&
            event.content.some((block) => block.type === 'text' && block.text === text),
        ),
    });
    await waitFor({
      name: 'idle after coordinator reply',
      read: () => sessions.retrieve(session.id),
      accept: (current) => current.status === 'idle',
    });
  }

  async function send(text: string) {
    return await sessions.events.send(session.id, {
      events: [{ type: 'user.message', content: [{ type: 'text', text }] }],
    });
  }

  async function waitForReport(text: string) {
    return await waitFor({
      name: `coordinator received ${text}`,
      read: async () => {
        const events = await sessions.events.list(session.id, { types: ['agent.thread_message_received'] });

        return events.data.find(
          (event) =>
            event.type === 'agent.thread_message_received' &&
            event.content.some((block) => block.type === 'text' && block.text === text),
        );
      },
      accept: (event) => event !== undefined,
    });
  }

  model.configure({
    marker: dispatch,
    replies: [
      { tools: [{ id: randomUUID(), name: 'delegate_to_agent', input: { agent_id: agent.id, message: task } }] },
      { text: 'Waiting.' },
    ],
  });
  model.configure({ marker: task, replies: [{ text: report }] });

  const firstReply = `Accepted initial report ${key}`;

  model.configure({ marker: report, replies: [{ text: firstReply }] });
  await send(dispatch);

  const first = await waitForReport(report);

  assert.ok(first?.type === 'agent.thread_message_received');

  const threadId = first.from_session_thread_id;

  await waitForCoordinator(firstReply);

  model.configure({
    marker: followup,
    replies: [
      { tools: [{ id: randomUUID(), name: 'send_to_thread', input: { thread_id: threadId, message: request } }] },
      { text: 'Checking.' },
    ],
  });
  model.configure({ marker: request, replies: [{ text: secondReport }] });

  const finalReply = `Accepted follow-up report ${key}`;

  model.configure({ marker: secondReport, replies: [{ text: finalReply }] });
  await send(followup);

  const second = await waitForReport(secondReport);

  assert.ok(second?.type === 'agent.thread_message_received');
  assert.equal(second.from_session_thread_id, threadId);

  await waitForCoordinator(finalReply);

  const resumed = await model.waitForCall({ marker: request, index: 0 });
  const called = JSON.stringify(resumed.body);

  assert.ok(called.includes(task));
  assert.ok(!called.includes(dispatch));

  const ended = await sessions.threads.archive(threadId, { session_id: session.id });

  assert.equal(ended.status, 'terminated');
  await sessions.delete(session.id);
}
