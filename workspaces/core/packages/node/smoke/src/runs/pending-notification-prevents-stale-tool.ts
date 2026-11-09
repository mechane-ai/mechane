import { TurnStatus } from '@mechane/protocol';
import {
  createMechContext,
  readConsoleMessages,
  readModelToolResult,
  readSandboxMachines,
  readTurns,
  requireFixtures,
  sendNotification,
  waitForTurn,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function pendingNotificationPreventsStaleTool({ stack }: ScenarioInput): Promise<void> {
  const marker = `correction-${randomUUID()}`;
  const staleText = `stale-${randomUUID()}`;
  const correctedText = `corrected-${randomUUID()}`;
  const staleCallId = randomUUID();
  const browserCallId = randomUUID();
  const owner = await createMechContext({ stack, name: marker });
  const { model } = requireFixtures(stack);
  const machines = await readSandboxMachines(stack);

  model.configure({
    marker,
    replies: [
      {
        isHeld: true,
        tools: [
          { id: staleCallId, name: 'console_message', input: { text: staleText } },
          { id: browserCallId, name: 'browser_open', input: { url: 'about:blank' } },
        ],
      },
      { tools: [{ id: randomUUID(), name: 'console_message', input: { text: correctedText } }] },
      { text: `private-${randomUUID()}` },
    ],
  });

  const original = await sendNotification({ ...owner, text: marker });

  await model.waitForCall({ marker, index: 0 });

  const correction = await sendNotification({ ...owner, text: `${marker}: use ${correctedText}` }).finally(() => {
    model.release({ marker, index: 0 });
  });

  const reconsideration = await model.waitForCall({ marker, index: 1 });
  const messages = reconsideration.body['messages'];

  const result = await readModelToolResult({ model, marker, toolCallId: staleCallId });
  const browserResult = await readModelToolResult({ model, marker, toolCallId: browserCallId });

  assert.deepEqual(result, { status: 'not_started', reason: 'notifications_pending' });
  assert.deepEqual(browserResult, result, 'The browser renderer could not represent a vetoed tool');
  assert.deepEqual(await readSandboxMachines(stack), machines, 'A stale browser call allocated a computer');
  assert.ok(JSON.stringify(messages).includes(correction.id), 'The reconsideration omitted the accepted correction');

  const completed = await waitForTurn({ ...owner, notificationId: correction.id });
  const runs = await readTurns(owner);
  const conversation = await readConsoleMessages(owner);

  assert.equal(completed.status, TurnStatus.Completed);
  assert.equal(runs.length, 1, 'An active notification started another owner');
  assert.ok(completed.notificationIds.includes(original.id));
  assert.deepEqual(
    conversation.messages.filter((message) => message.role === 'assistant').map((message) => message.text),
    [correctedText],
  );
}
