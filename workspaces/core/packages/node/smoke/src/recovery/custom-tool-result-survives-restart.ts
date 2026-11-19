import type { BetaManagedAgentsUserCustomToolResultEventParams } from '@anthropic-ai/sdk/resources/beta/sessions/events';
import { HttpStatusCode } from '@mechane/records';
import { createManagedContext, requireFixtures, waitFor } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { waitForReply } from '../runs/session-messages.ts';
import { readSessionEvents } from './read-session-events.ts';

const CALLS_THROUGH_TOOL_RESULT = 2;

export async function customToolResultSurvivesRestart({ stack }: ScenarioInput): Promise<void> {
  const { model } = requireFixtures(stack);
  const request = `approval-${randomUUID()}`;
  const unrelated = `other-work-${randomUUID()}`;
  const result = `approved-${randomUUID()}`;
  const answer = `completed-${randomUUID()}`;
  const tool = 'request_access';

  const { agent, environment, session, client } = await createManagedContext({
    stack,
    name: request,
    agent: { tools: [{ type: 'custom', name: tool, description: 'Request access', input_schema: { type: 'object' } }] },
  });

  const other = await client.beta.sessions.create({ agent: agent.id, environment_id: environment.id });

  model.configure({
    marker: request,
    replies: [{ tools: [{ id: randomUUID(), name: tool, input: {} }] }, { text: answer }],
  });
  model.configure({ marker: unrelated, replies: [{ text: unrelated }] });
  await client.beta.sessions.events.send(session.id, {
    events: [{ type: 'user.message', content: [{ type: 'text', text: request }] }],
  });

  const calls = await waitFor({
    name: 'agent requests the external result',
    read: () => client.beta.sessions.events.list(session.id, { types: ['agent.custom_tool_use'] }),
    accept: (page) => page.data.length > 0,
  });

  const call = calls.data.find((event) => event.type === 'agent.custom_tool_use');

  assert.ok(call !== undefined && call.name === tool);

  await client.beta.sessions.events.send(other.id, {
    events: [{ type: 'user.message', content: [{ type: 'text', text: unrelated }] }],
  });
  await waitForReply({ client, session: other }, unrelated);
  await stack.restart({ signal: 'SIGKILL' });

  const event: BetaManagedAgentsUserCustomToolResultEventParams = {
    type: 'user.custom_tool_result',
    custom_tool_use_id: call.id,
    content: [{ type: 'text', text: result }],
  };

  await assert.rejects(client.beta.sessions.events.send(other.id, { events: [event] }), {
    status: HttpStatusCode.BadRequest,
  });
  await client.beta.sessions.events.send(session.id, { events: [event] });

  await waitFor({
    name: 'the original session resumes from the recovered tool call',
    read: () => client.beta.sessions.events.list(session.id, { types: ['agent.message', 'session.status_idle'] }),
    accept: (page) => {
      const last = page.data.at(-1);

      return (
        page.data.some((entry) => entry.type === 'agent.message') &&
        last?.type === 'session.status_idle' &&
        last.stop_reason.type === 'end_turn'
      );
    },
  });

  const history = await readSessionEvents({ client, id: session.id });
  const answers = history.filter((entry) => entry.type === 'agent.message');

  assert.equal(answers.length, 1);

  const resumed = answers[0];

  assert.ok(resumed !== undefined);
  assert.ok(resumed.content.some((part) => part.type === 'text' && part.text === answer));
  assert.ok(JSON.stringify(model.readCalls({ marker: request }).at(-1)?.body).includes(result));

  const initialUsage = history.filter((entry) => entry.type === 'session.usage');

  assert.ok(initialUsage.length > 0);

  const resumedCalls = model.readCalls({ marker: request }).length;

  assert.equal(resumedCalls, CALLS_THROUGH_TOOL_RESULT);

  await stack.restart({ signal: 'SIGKILL' });
  await client.beta.sessions.events.send(session.id, { events: [event] });

  const replay = await readSessionEvents({ client, id: session.id });

  assert.deepEqual(
    replay.filter((entry) => entry.type === 'agent.message'),
    answers,
  );
  assert.deepEqual(
    replay.filter((entry) => entry.type === 'session.usage'),
    initialUsage,
  );
  assert.equal(model.readCalls({ marker: request }).length, resumedCalls);

  const otherHistory = await readSessionEvents({ client, id: other.id });

  assert.ok(!JSON.stringify(otherHistory).includes(result));
}
