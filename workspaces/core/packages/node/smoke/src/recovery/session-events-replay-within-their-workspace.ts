import Anthropic, { APIError } from '@anthropic-ai/sdk';
import type { BetaManagedAgentsSessionEventType } from '@anthropic-ai/sdk/resources/beta/sessions/events';
import { HttpStatusCode } from '@mechane/records';
import { createAccount, createManagedContext, requireFixtures } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { waitForReply } from '../runs/session-messages.ts';
import { readSessionEvents } from './read-session-events.ts';

const inaccessibleStatuses: ReadonlySet<number> = new Set([HttpStatusCode.Forbidden, HttpStatusCode.NotFound]);

export async function sessionEventsReplayWithinTheirWorkspace({ stack }: ScenarioInput): Promise<void> {
  const { github, model } = requireFixtures(stack);
  const marker = `private-session-${randomUUID()}`;
  const { client, session } = await createManagedContext({ stack, name: marker });
  const outsider = await createAccount({ stack, login: github.users.member.login });
  const foreign = new Anthropic({ baseURL: stack.origin.origin, apiKey: outsider.token, maxRetries: 0 });
  const anonymous = new Anthropic({ baseURL: stack.origin.origin, apiKey: 'invalid-fixture-key', maxRetries: 0 });
  const expected = [`first-${randomUUID()}`, `second-${randomUUID()}`];
  const types: Array<BetaManagedAgentsSessionEventType> = ['user.message', 'agent.message'];

  model.configure({ marker, replies: expected.map((text) => ({ text })) });

  for (const text of expected) {
    await client.beta.sessions.events.send(session.id, {
      events: [{ type: 'user.message', content: [{ type: 'text', text: `${marker} ${text}` }] }],
    });
    await waitForReply({ client, session }, text);
  }

  const events = await readSessionEvents({ client, id: session.id, query: { types } });

  assert.deepEqual(
    events.map((entry) => entry.type),
    ['user.message', 'agent.message', 'user.message', 'agent.message'],
  );
  assert.equal(new Set(events.map((entry) => entry.id)).size, events.length);

  const first = await client.beta.sessions.events.list(session.id, { types, limit: 1 });

  assert.ok(first.next_page !== null);
  assert.equal(first.data[0]?.id, events[0]?.id);

  await stack.restart({ signal: 'SIGKILL' });

  const remainder = await readSessionEvents({
    client,
    id: session.id,
    query: { types, limit: 1, page: first.next_page },
  });

  assert.deepEqual(remainder, events.slice(1));
  assert.deepEqual(
    await readSessionEvents({ client, id: session.id, query: { types, order: 'desc', limit: 1 } }),
    events.toReversed(),
  );
  await assert.rejects(
    foreign.beta.sessions.events.list(session.id, { page: first.next_page }),
    (cause: unknown) =>
      cause instanceof APIError && typeof cause.status === 'number' && inaccessibleStatuses.has(cause.status),
  );
  await assert.rejects(anonymous.beta.sessions.events.list(session.id, { page: first.next_page }), {
    status: HttpStatusCode.Unauthorized,
  });
  assert.equal(model.readCalls({ marker }).length, expected.length, 'Replaying a cursor repeated paid inference');
}
