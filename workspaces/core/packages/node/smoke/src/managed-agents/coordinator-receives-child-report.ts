import Anthropic from '@anthropic-ai/sdk';
import { createAccount, requireFixtures, waitFor } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const previewTimeoutMs = 30_000;

export async function coordinatorReceivesChildReport({ stack }: ScenarioInput): Promise<void> {
  const { github, model } = requireFixtures(stack);
  const account = await createAccount({ stack, login: github.users.owner.login });
  const client = new Anthropic({ baseURL: stack.origin.origin, apiKey: account.token, maxRetries: 0 });
  const { environments, sessions, agents } = client.beta;
  const key = randomUUID();
  const modelId = 'claude-haiku-5-5';
  const environment = await environments.create({ name: key, config: { type: 'self_hosted' } });

  const child = await agents.create({
    name: `verifier-${key}`,
    model: modelId,
    tools: [
      { type: 'custom', name: 'inspect_receipt', description: 'Read the receipt.', input_schema: { type: 'object' } },
    ],
  });

  const coordinator = await agents.create({
    name: `coordinator-${key}`,
    model: modelId,
    multiagent: { type: 'coordinator', agents: [{ type: 'agent', id: child.id, version: child.version }] },
  });

  const session = await sessions.create({ agent: coordinator.id, environment_id: environment.id });
  const request = `Coordinator private request ${key}`;
  const task = `Check receipt ${key}`;
  const reportPrefix = 'Verified ';
  const reportSuffix = `receipt ${key}`;
  const report = reportPrefix + reportSuffix;
  const rawResult = `Private tool output ${key}`;
  const followup = `Confirm the original receipt a second time ${key}`;
  const secondReport = `Same receipt confirmed ${key}`;
  const final = `Accepted evidence ${key}`;

  model.configure({
    marker: request,
    replies: [
      { tools: [{ id: randomUUID(), name: 'delegate_to_agent', input: { agent_id: child.id, message: task } }] },
      { text: 'Waiting for verification.' },
    ],
  });
  model.configure({
    marker: task,
    replies: [
      { tools: [{ id: randomUUID(), name: 'inspect_receipt', input: {} }] },
      { holdAfterPrefix: { text: reportPrefix, thinking: 'Private child reasoning' }, text: reportSuffix },
    ],
  });
  model.configure({ marker: followup, replies: [{ text: secondReport }] });
  model.configure({ marker: secondReport, replies: [{ text: final }] });
  await sessions.events.send(session.id, {
    events: [{ type: 'user.message', content: [{ type: 'text', text: request }] }],
  });

  const awaiting = await waitFor({
    name: 'child custom tool available on coordinator stream',
    read: () => sessions.events.list(session.id, { types: ['agent.custom_tool_use'] }),
    accept: (page) =>
      page.data.some((event) => event.type === 'agent.custom_tool_use' && event.name === 'inspect_receipt'),
  });

  const use = awaiting.data.find((event) => event.type === 'agent.custom_tool_use' && event.name === 'inspect_receipt');

  assert.ok(use?.type === 'agent.custom_tool_use' && typeof use.session_thread_id === 'string');

  const threadId = use.session_thread_id;
  const thread = await sessions.threads.retrieve(threadId, { session_id: session.id });

  assert.equal(thread.agent.type, 'agent');
  assert.equal(thread.agent.id, child.id);

  const childCall = await model.waitForCall({ marker: task, index: 0 });

  assert.ok(!JSON.stringify(childCall.body).includes(request));

  model.configure({
    marker: report,
    replies: [
      { tools: [{ id: randomUUID(), name: 'send_to_thread', input: { thread_id: threadId, message: followup } }] },
      { text: 'Waiting for the second check.' },
    ],
  });

  const childStream = await sessions.threads.events.stream(
    threadId,
    { session_id: session.id, event_deltas: ['agent.message'] },
    { signal: AbortSignal.timeout(previewTimeoutMs) },
  );

  const sent = await sessions.events.send(session.id, {
    events: [
      { type: 'user.custom_tool_result', custom_tool_use_id: use.id, content: [{ type: 'text', text: rawResult }] },
    ],
  });

  const preview: { previewId?: string; confirmedId?: string } = {};

  try {
    for await (const frame of childStream) {
      if (frame.type === 'event_delta' && preview.previewId === undefined) {
        assert.equal(frame.delta.content.text, reportPrefix);

        preview.previewId = frame.event_id;

        model.release({ marker: task, index: 1 });
      }

      if (frame.type === 'agent.message') {
        assert.deepEqual(frame.content, [{ type: 'text', text: report }]);

        preview.confirmedId = frame.id;
        break;
      }
    }
  } finally {
    model.release({ marker: task, index: 1 });
    childStream.controller.abort();
  }

  assert.ok(preview.previewId !== undefined);
  assert.equal(preview.confirmedId, preview.previewId);

  const result = sent.data?.[0];

  assert.ok(result?.type === 'user.custom_tool_result');

  const root = await waitFor({
    name: 'coordinator reply after receiving the child report',
    read: () => sessions.events.list(session.id, { limit: 100 }),
    accept: (page) =>
      page.data.some(
        (event) =>
          event.type === 'agent.message' &&
          event.content.some((block) => block.type === 'text' && block.text === final),
      ),
  });

  const received = root.data.filter((event) => event.type === 'agent.thread_message_received');

  assert.equal(received.length, [report, secondReport].length);

  for (const text of [report, secondReport]) {
    const reply = received.find((event) => event.content.some((block) => block.type === 'text' && block.text === text));

    assert.ok(reply !== undefined);
    assert.equal(reply.from_session_thread_id, threadId);
    assert.equal(reply.from_agent_name, child.name);
  }

  assert.equal(root.data.filter((event) => event.type === 'session.thread_created').length, 1);
  assert.equal(root.data.filter((event) => event.type === 'user.custom_tool_result').length, 1);

  const childHistory = await sessions.threads.events.list(threadId, { session_id: session.id, limit: 100 });

  assert.deepEqual(
    childHistory.data.filter((event) => event.type === 'agent.custom_tool_use').map((event) => event.id),
    [use.id],
  );
  assert.deepEqual(
    childHistory.data.filter((event) => event.type === 'user.custom_tool_result').map((event) => event.id),
    [result.id],
  );
  assert.ok(
    childHistory.data.some(
      (event) =>
        event.type === 'agent.thread_message_sent' &&
        event.to_session_thread_id === thread.parent_thread_id &&
        event.to_agent_name === undefined,
    ),
  );

  const messages = childHistory.data.filter((event) => event.type === 'agent.thread_message_received');

  assert.equal(messages.length, [task, followup].length);

  for (const text of [task, followup]) {
    const message = messages.find((event) =>
      event.content.some((block) => block.type === 'text' && block.text === text),
    );

    assert.ok(message !== undefined);
    assert.equal(message.from_session_thread_id, thread.parent_thread_id);
    assert.equal(message.from_agent_name, undefined);
  }

  const secondChildCall = await model.waitForCall({ marker: followup, index: 0 });

  assert.ok(JSON.stringify(secondChildCall.body).includes(rawResult));
  assert.ok(JSON.stringify(secondChildCall.body).includes(task));
  assert.ok(!JSON.stringify(secondChildCall.body).includes(request));

  const childResume = await model.waitForCall({ marker: task, index: 1 });

  assert.ok(JSON.stringify(childResume.body).includes(rawResult));

  const coordinatorResume = await model.waitForCall({ marker: report, index: 0 });

  assert.ok(!JSON.stringify(coordinatorResume.body).includes(rawResult));
  assert.ok(thread.parent_thread_id !== null);

  const primaryHistory = await sessions.threads.events.list(thread.parent_thread_id, {
    session_id: session.id,
    limit: 100,
  });

  assert.deepEqual(
    primaryHistory.data.filter((event) => event.type === 'agent.thread_message_received').map((event) => event.id),
    received.map((event) => event.id),
  );

  const idle = await sessions.threads.list(session.id, { statuses: ['idle'] });

  assert.ok(idle.data.some((sessionThread) => sessionThread.id === threadId));
  assert.ok(idle.data.every((sessionThread) => sessionThread.status === 'idle'));

  const archived = await sessions.threads.archive(threadId, { session_id: session.id });

  assert.equal(archived.status, 'terminated');
  assert.ok(archived.archived_at !== null);
  assert.equal(archived.stats?.startup_seconds, 0);
  assert.equal(archived.usage?.active_seconds, archived.stats.active_seconds);

  const modernCoordinator = await agents.create({
    name: `modern-${key}`,
    model: modelId,
    multiagent: {
      type: 'multiagent_20261001',
      subagents: { type: 'enabled', predefined_agents: [{ type: 'agent', id: child.id, version: child.version }] },
    },
  });

  assert.partialDeepStrictEqual(modernCoordinator.multiagent, {
    type: 'multiagent_20261001',
    workflows: { type: 'disabled' },
    subagents: {
      type: 'enabled',
      inline_agents: { type: 'disabled' },
      predefined_agents: [{ type: 'agent', id: child.id, version: child.version }],
    },
    advisor: { type: 'disabled' },
  });

  const modernSession = await sessions.create({ agent: modernCoordinator.id, environment_id: environment.id });

  assert.partialDeepStrictEqual(modernSession.agent.multiagent, {
    type: 'multiagent_20261001',
    subagents: { type: 'enabled', predefined_agents: [{ id: child.id, version: child.version }] },
  });
  await sessions.archive(modernSession.id);
  await agents.archive(modernCoordinator.id);

  const terminated = await sessions.threads.list(session.id, { statuses: ['terminated'] });

  assert.deepEqual(
    terminated.data.map((sessionThread) => sessionThread.id),
    [threadId],
  );
}
