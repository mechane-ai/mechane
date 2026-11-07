import { TurnStatus, UnansweredReason } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import {
  createAccount,
  createMech,
  readNativeChunks,
  readTurns,
  replayNativeChat,
  requireFixtures,
  startNativeChat,
  waitFor,
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

  fixtures.model.configure({ marker, replies: [{ status: HttpStatusCode.BadRequest }] });

  const started = await startNativeChat({ stack, account, mechId: mech.id, text: marker });
  const chunks = await readNativeChunks(started.response);

  assert.ok(chunks.some((chunk) => chunk.type === 'error'));

  const turns = await waitFor({
    name: 'the failed model request to end its run',
    read: () => readTurns({ stack, account, mechId: mech.id }),
    accept: (observed) => observed.some((turn) => turn.status === TurnStatus.Unanswered),
  });

  const failed = turns[0];

  if (failed?.status !== TurnStatus.Unanswered) {
    throw new Error('The failed model request has no terminal run');
  }

  assert.equal(failed.reason, UnansweredReason.Faulted);

  const replayInput = { origin: stack.origin, token: account.token, workflowRunId: started.workflowRunId };
  const replayResponse = await replayNativeChat(replayInput);
  const replay = await readNativeChunks(replayResponse);

  assert.deepEqual(replay, chunks);

  const startIndex = Math.floor(chunks.length * REPLAY_START_FRACTION);
  const resumedResponse = await replayNativeChat({ ...replayInput, startIndex });
  const resumed = await readNativeChunks(resumedResponse);

  assert.deepEqual(resumed, chunks.slice(startIndex));
  assert.equal(fixtures.model.readCalls({ marker }).length, 1);
}
