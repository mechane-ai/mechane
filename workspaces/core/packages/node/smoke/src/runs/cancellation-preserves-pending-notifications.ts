import { TurnCancel, TurnStatus } from '@mechane/protocol';
import {
  createAccount,
  createMech,
  readConsoleMessages,
  requireFixtures,
  runCli,
  sendNotification,
  startHeldActivation,
  waitForTurn,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { cancellationSurvivesEnvironmentOutage } from './cancellation-survives-environment-outage.ts';

export async function cancellationPreservesPendingNotifications({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack });
  const marker = `cancelled-${randomUUID()}`;
  const nextMarker = `next-${randomUUID()}`;
  const mech = await createMech({ stack, account, name: marker });
  const fixtures = requireFixtures(stack);

  fixtures.model.configure({
    marker,
    replies: [{ isHeld: true, tools: [{ id: randomUUID(), name: 'console_message', input: { text: marker } }] }],
  });
  fixtures.model.configure({
    marker: nextMarker,
    replies: [
      { tools: [{ id: randomUUID(), name: 'console_message', input: { text: nextMarker } }] },
      { text: 'Complete' },
    ],
  });

  const owner = { stack, account, mechId: mech.id };
  const { notification: sent, turn: running } = await startHeldActivation({ ...owner, marker });

  const next = await sendNotification({ ...owner, text: nextMarker });

  try {
    await runCli({
      stack,
      account,
      args: ['turn', 'cancel', mech.id, running.id, '--workspace', account.workspaceId],
      schema: TurnCancel,
    });
  } finally {
    fixtures.model.release({ marker, index: 0 });
  }

  const cancelled = await waitForTurn({ ...owner, notificationId: sent.id });
  const completed = await waitForTurn({ ...owner, notificationId: next.id });

  if (cancelled.status !== TurnStatus.Stopped) {
    throw new Error('Cancellation did not end the active run');
  }

  assert.equal(completed.status, TurnStatus.Completed);

  const conversation = await readConsoleMessages(owner);

  assert.deepEqual(
    conversation.messages.filter((message) => message.role === 'assistant').map((message) => message.text),
    [nextMarker],
  );

  await cancellationSurvivesEnvironmentOutage(owner);
}
