import { Mech, TurnStatus } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
import {
  connectSlack,
  createAccount,
  createMech,
  postSlackMessage,
  readTurns,
  requireFixtures,
  runCli,
  waitFor,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const MILLISECONDS_PER_SECOND = 1000;

export async function pausedAdmissionResumes({ stack }: ScenarioInput): Promise<void> {
  const fixtures = requireFixtures(stack);
  const account = await createAccount({ stack });
  const marker = `paused-${randomUUID()}`;
  const mech = await createMech({ stack, account, name: marker });
  const slack = await connectSlack({ stack, account, mechId: mech.id });

  fixtures.model.configure({ marker, replies: [{ text: marker }] });

  const paused = await runCli({
    stack,
    account,
    args: ['mech', 'pause', mech.id, '--workspace', account.workspaceId, '--expected-revision', String(mech.revision)],
    schema: Mech,
  });

  const input = { stack, account, mechId: mech.id };
  const messageTimestamp = `${Math.floor(Date.now() / MILLISECONDS_PER_SECOND)}.000001`;
  const earlierCalls = fixtures.slack.readCalls().length;

  const accepted = await postSlackMessage({
    origin: stack.origin,
    workspaceId: account.workspaceId,
    slack,
    text: marker,
    messageTimestamp,
  });

  assert.equal(accepted.status, HttpStatusCode.Ok);

  await waitFor({
    name: 'the paused workflow to acknowledge its queued input',
    read: async () => fixtures.slack.readCalls().slice(earlierCalls),
    accept: (calls) =>
      calls.some(
        (call) =>
          call.method === 'reactions.add' &&
          call.body['channel'] === slack.channelId &&
          call.body['timestamp'] === messageTimestamp,
      ),
  });

  const queued = await readTurns(input);

  assert.equal(queued.length, 1);
  assert.equal(queued[0]?.status, TurnStatus.Queued);
  assert.equal(fixtures.model.readCalls({ marker }).length, 0);

  await runCli({
    stack,
    account,
    args: [
      'mech',
      'resume',
      mech.id,
      '--workspace',
      account.workspaceId,
      '--expected-revision',
      String(paused.revision),
    ],
    schema: Mech,
  });

  await waitFor({
    name: 'the queued input to receive its Slack reply after resume',
    read: async () => fixtures.slack.readMessages(),
    accept: (messages) => messages.some((message) => JSON.stringify(message).includes(marker)),
  });

  const completed = await readTurns(input);

  assert.equal(completed[0]?.status, TurnStatus.Answered);
  assert.equal(fixtures.model.readCalls({ marker }).length, 1);
}
