import { TurnStatus } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import {
  createAccount,
  createMech,
  nativeChatText,
  readNativeChat,
  readNativeChunks,
  readNativeConversation,
  readTurns,
  replayNativeChat,
  requireFixtures,
  startNativeChat,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
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
  const mech = await createMech({ stack, account, name: marker });

  fixtures.model.configure({ marker, replies: [{ text: expectedReply }] });

  const started = await startNativeChat({ stack, account, mechId: mech.id, text: marker });

  const original = await readNativeChat(started.response);
  const completed = await readTurns({ stack, account, mechId: mech.id });

  assert.equal(completed[0]?.status, TurnStatus.Answered);
  assert.equal(nativeChatText(original.message), expectedReply);

  await stack.restart();

  const replayResponse = await replayNativeChat({
    origin: stack.origin,
    token: account.token,
    workflowRunId: started.workflowRunId,
  });

  const replay = await readNativeChat(replayResponse);

  assert.deepEqual(replay.chunks, original.chunks);
  assert.equal(nativeChatText(replay.message), expectedReply);

  const history = await readNativeConversation({
    origin: stack.origin,
    token: account.token,
    workspaceId: account.workspaceId,
    mechId: mech.id,
  });

  const replies = history.filter((message) => message.role === 'assistant');

  assert.equal(replies.length, 1);
  assert.equal(replies[0]?.id, original.message.id);
  assert.equal(JSON.stringify(replies[0].parts), JSON.stringify(original.message.parts));

  const startIndex = Math.floor(original.chunks.length * REPLAY_START_FRACTION);

  const resumedResponse = await replayNativeChat({
    origin: stack.origin,
    token: account.token,
    workflowRunId: started.workflowRunId,
    startIndex,
  });

  const resumed = await readNativeChunks(resumedResponse);

  assert.deepEqual(resumed, original.chunks.slice(startIndex));

  const forbidden = await replayNativeChat({
    origin: stack.origin,
    token: other.token,
    workflowRunId: started.workflowRunId,
  });

  assert.ok(INACCESSIBLE_STATUSES.has(forbidden.status));

  const anonymous = await replayNativeChat({ origin: stack.origin, workflowRunId: started.workflowRunId });

  assert.equal(anonymous.status, HttpStatusCode.Unauthorized);
  assert.equal(fixtures.model.readCalls({ marker }).length, 1);
}
