import { TurnStatus, UnansweredReason } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import {
  createAccount,
  createMech,
  readConsoleMessages,
  readNativeChunks,
  readNativeTrace,
  requireFixtures,
  sendNotificationAndWait,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const REPLAY_START_FRACTION = 0.5;

export async function nativeStreamFailureIsReplayable({ stack }: ScenarioInput): Promise<void> {
  const fixtures = requireFixtures(stack);
  const account = await createAccount({ stack });
  const marker = `failed-stream-${randomUUID()}`;
  const mech = await createMech({ stack, account, name: marker });
  const owner = { stack, account, mechId: mech.id };

  fixtures.model.configure({ marker, replies: [{ status: HttpStatusCode.BadRequest }] });

  const failed = await sendNotificationAndWait({ ...owner, text: marker });

  if (failed.status !== TurnStatus.Failed) {
    throw new Error('The failed model request has no terminal activation');
  }

  assert.equal(failed.reason, UnansweredReason.Faulted);

  const address = {
    origin: stack.origin,
    workspaceId: account.workspaceId,
    mechId: mech.id,
    turnId: failed.id,
    token: account.token,
  };

  const chunks = await readNativeChunks(await readNativeTrace(address));

  assert.ok(chunks.some((chunk) => chunk.type === 'error'));

  const replay = await readNativeChunks(await readNativeTrace(address));

  assert.deepEqual(replay, chunks);

  const startIndex = Math.floor(chunks.length * REPLAY_START_FRACTION);
  const resumed = await readNativeChunks(await readNativeTrace({ ...address, startIndex }));

  assert.deepEqual(resumed, chunks.slice(startIndex));
  assert.equal(fixtures.model.readCalls({ marker }).length, 1);

  const conversation = await readConsoleMessages(owner);

  assert.equal(conversation.messages.filter((message) => message.role === 'assistant').length, 0);
}
