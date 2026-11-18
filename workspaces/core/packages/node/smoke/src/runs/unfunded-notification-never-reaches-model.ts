import { DispatchStatus, Mech, TurnStatus, UnansweredReason } from '@mechane/protocol';
import {
  createAccount,
  createMech,
  readConsoleMessages,
  readTrace,
  requireFixtures,
  runCli,
  sendNotification,
  sendNotificationAndWait,
  waitForTurn,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const UNFUNDED_BACKLOG = 5;
const CONTEXT_REPETITIONS = 490;

export async function unfundedNotificationNeverReachesModel({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack });
  const marker = `budget-refusal-${randomUUID()}`;
  const mech = await createMech({ stack, account, name: marker, dailyCapMicros: 1 });
  const fixtures = requireFixtures(stack);

  fixtures.model.configure({
    marker,
    replies: [{ text: 'This generation must not be sent' }],
    summary: 'The earlier requests could not be reviewed.',
  });

  const input = { stack, account, mechId: mech.id };
  const turn = await sendNotificationAndWait({ ...input, text: marker });

  if (turn.status !== TurnStatus.Failed) {
    throw new Error('The unfunded input completed without a budget refusal');
  }

  assert.equal(turn.reason, UnansweredReason.AllowanceExhausted);
  assert.equal(fixtures.model.readCalls({ marker }).length, 0);

  const trace = await readTrace({ ...input, turnId: turn.id });

  assert.ok(
    (trace.evidenceNotices ?? []).some((notice) => notice.includes('"category":"admission_error"')),
    'The trace must distinguish local admission refusal from an upstream model rejection',
  );

  assert.deepEqual(
    trace.dispatches.map((dispatch) => dispatch.status),
    [DispatchStatus.Refused],
  );

  const refusedContext = `\n${'An earlier notification could not be processed while the daily allowance was exhausted. '.repeat(CONTEXT_REPETITIONS)}`;

  for (let attempt = 0; attempt < UNFUNDED_BACKLOG; attempt += 1) {
    const exhausted = await sendNotificationAndWait({ ...input, text: `${marker} ${attempt}${refusedContext}` });

    assert.equal(exhausted.status, TurnStatus.Failed);
  }

  const paused = await runCli({
    ...input,
    args: [
      'mech',
      'update',
      mech.id,
      '--workspace',
      account.workspaceId,
      '--expected-revision',
      String(mech.revision),
      '--status',
      'paused',
    ],
    schema: Mech,
  });

  const fresh = `funded-review-${randomUUID()}`;
  const publication = `review-published-${randomUUID()}`;

  fixtures.model.configure({
    marker: fresh,
    summary: 'Prior unfunded requests were not reviewed.',
    replies: [
      { tools: [{ id: randomUUID(), name: 'console_message', input: { text: publication } }] },
      { text: 'Finished' },
    ],
  });

  const notification = await sendNotification({ ...input, text: fresh });

  await runCli({
    ...input,
    args: [
      'mech',
      'update',
      mech.id,
      '--workspace',
      account.workspaceId,
      '--expected-revision',
      String(paused.revision),
      '--daily-cap-micros',
      '1000000',
      '--status',
      'active',
    ],
    schema: Mech,
  });

  const recovered = await waitForTurn({ ...input, notificationId: notification.id });

  assert.equal(recovered.status, TurnStatus.Completed, JSON.stringify(recovered));

  const conversation = await readConsoleMessages(input);

  assert.ok(
    conversation.messages.some((message) => message.text === publication && message.role === 'assistant'),
    'The resumed turn must publish after terminal inputs leave its working context',
  );
}
