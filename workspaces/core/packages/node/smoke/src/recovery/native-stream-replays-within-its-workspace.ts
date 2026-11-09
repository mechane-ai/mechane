import { TurnStatus } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import {
  createAccount,
  createMech,
  readConsoleMessages,
  readNativeChunks,
  readNativeTrace,
  readTurns,
  requireFixtures,
  startHeldActivation,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Option } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const REPLAY_START_FRACTION = 0.5;
const INACCESSIBLE_STATUSES: ReadonlySet<number> = new Set([HttpStatusCode.Forbidden, HttpStatusCode.NotFound]);

export async function nativeStreamReplaysWithinItsWorkspace({ stack }: ScenarioInput): Promise<void> {
  const fixtures = requireFixtures(stack);
  const account = await createAccount({ stack });
  const other = await createAccount({ stack, login: fixtures.github.users.owner.login });
  const marker = `stream-${randomUUID()}`;
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

  const modelReplies = [
    {
      isHeld: true,
      tools: [{ id: randomUUID(), name: 'console_message', input: { text: expectedReply, presentation } }],
    },
    { text: privateText },
  ];

  fixtures.model.configure({ marker, replies: modelReplies });

  const { turn: running } = await startHeldActivation({ ...owner, marker });

  const traceAddress = { origin: stack.origin, workspaceId: account.workspaceId, mechId: mech.id, turnId: running.id };
  const stream = await readNativeTrace({ ...traceAddress, token: account.token });

  fixtures.model.release({ marker, index: 0 });

  const original = await readNativeChunks(stream);
  const completed = await readTurns(owner);

  assert.equal(completed.find((turn) => turn.id === running.id)?.status, TurnStatus.Completed);

  const conversation = await readConsoleMessages(owner);
  const published = conversation.messages.filter((message) => message.role === 'assistant');

  assert.equal(published.length, 1);

  const publication = published[0];

  assert.ok(publication !== undefined);
  assert.equal(publication.text, expectedReply);
  assert.deepEqual(Option.getOrThrow(publication.presentation), { spec: presentation, fallback: expectedReply });
  assert.equal(JSON.stringify(published).includes(privateText), false);

  await stack.restart();

  const replay = await readNativeChunks(await readNativeTrace({ ...traceAddress, token: account.token }));

  assert.deepEqual(replay, original);
  assert.deepEqual(await readConsoleMessages(owner), conversation, 'Restart repeated or lost explicit publication');

  const startIndex = Math.floor(original.length * REPLAY_START_FRACTION);
  const resumed = await readNativeChunks(await readNativeTrace({ ...traceAddress, token: account.token, startIndex }));

  assert.deepEqual(resumed, original.slice(startIndex));

  const forbidden = await readNativeTrace({ ...traceAddress, token: other.token });
  const anonymous = await readNativeTrace(traceAddress);

  assert.ok(INACCESSIBLE_STATUSES.has(forbidden.status));
  assert.equal(anonymous.status, HttpStatusCode.Unauthorized);
  assert.equal(fixtures.model.readCalls({ marker }).length, modelReplies.length);
}
