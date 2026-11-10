import { TurnStatus } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import {
  createAccount,
  createMech,
  eventsPath,
  historyPath,
  readConsoleMessages,
  readEvents,
  readTrace,
  requireFixtures,
  startHeldActivation,
  turnPath,
  waitForTurn,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Option } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const VIEW_READ_TIMEOUT_MS = 30_000;
const INACCESSIBLE_STATUSES: ReadonlySet<number> = new Set([HttpStatusCode.Forbidden, HttpStatusCode.NotFound]);

export async function actorViewsReplayWithinTheirWorkspace({ stack }: ScenarioInput): Promise<void> {
  const fixtures = requireFixtures(stack);
  const account = await createAccount({ stack });
  const other = await createAccount({ stack, login: fixtures.github.users.owner.login });
  const marker = `actor-views-${randomUUID()}`;
  const expectedReply = `reply-${randomUUID()}`;
  const privateText = `private-${randomUUID()}`;
  const mech = await createMech({ stack, account, name: marker });
  const owner = { stack, account, mechId: mech.id };

  const presentation = {
    root: 'result',
    elements: {
      result: { type: 'Card', props: {}, children: ['answer'] },
      answer: { type: 'Text', props: { content: expectedReply }, children: [] },
    },
  };

  const replies = [
    {
      isHeld: true,
      tools: [{ id: randomUUID(), name: 'console_message', input: { text: expectedReply, presentation } }],
    },
    { text: privateText },
  ];

  fixtures.model.configure({ marker, replies });

  const { notification, turn: running } = await startHeldActivation({ ...owner, marker });

  try {
    const active = await readTrace({ ...owner, turnId: running.id });

    assert.equal(active.turn.status, TurnStatus.Running);
  } finally {
    fixtures.model.release({ marker, index: 0 });
  }

  const completed = await waitForTurn({ ...owner, notificationId: notification.id });

  assert.equal(completed.status, TurnStatus.Completed);

  const address = { ...owner, turnId: running.id };
  const original = await readTrace(address);
  const events = await readEvents(owner);
  const cursor = events.events[0]?.sequence;

  assert.ok(cursor !== undefined);

  const resumed = await readEvents({ ...owner, after: cursor });

  assert.deepEqual(
    resumed.events,
    events.events.filter((event) => event.sequence > cursor),
  );

  const conversation = await readConsoleMessages(owner);
  const published = conversation.messages.filter((message) => message.role === 'assistant');
  const publication = published[0];

  assert.equal(published.length, 1, 'The explicit structured publication was not retained');
  assert.ok(publication !== undefined);
  assert.equal(publication.text, expectedReply);
  assert.deepEqual(Option.getOrThrow(publication.presentation), { spec: presentation, fallback: expectedReply });
  assert.equal(JSON.stringify(published).includes(privateText), false);

  await stack.restart({ signal: 'SIGKILL' });

  assert.deepEqual(await readTrace(address), original);
  assert.deepEqual(await readEvents(owner), events);
  assert.deepEqual(await readEvents({ ...owner, after: cursor }), resumed);
  assert.deepEqual(await readConsoleMessages(owner), conversation, 'Restart repeated or lost explicit publication');

  for (const path of [turnPath(address), eventsPath(owner), historyPath(owner)]) {
    const forbidden = await fetch(new URL(path, stack.origin), {
      headers: { [HttpHeader.Authorization]: `Bearer ${other.token}` },
      signal: AbortSignal.timeout(VIEW_READ_TIMEOUT_MS),
    });

    const anonymous = await fetch(new URL(path, stack.origin), { signal: AbortSignal.timeout(VIEW_READ_TIMEOUT_MS) });

    assert.ok(INACCESSIBLE_STATUSES.has(forbidden.status));
    assert.equal(anonymous.status, HttpStatusCode.Unauthorized);
  }

  assert.equal(fixtures.model.readCalls({ marker }).length, replies.length);
}
