import {
  createAccount,
  createMech,
  deliverNotification,
  readConsoleMessages,
  requireFixtures,
  sendNotificationAndWait,
  waitForTurn,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const EXTERNAL_RESULT_MODEL_CALLS = 3;

export async function externalNotificationSurvivesRestart({ stack }: ScenarioInput): Promise<void> {
  const fixtures = requireFixtures(stack);
  const account = await createAccount({ stack });
  const marker = `external-result-${randomUUID()}`;
  const otherMarker = `other-work-${randomUUID()}`;
  const result = `resumed-${randomUUID()}`;
  const requestId = randomUUID();
  const notificationId = randomUUID();
  const mech = await createMech({ stack, account, name: marker });
  const owner = { stack, account, mechId: mech.id };
  const producer = fixtures.notifications;

  fixtures.model.configure({
    marker,
    replies: [
      { text: `The request ${requestId} will complete later` },
      { tools: [{ id: randomUUID(), name: 'console_message', input: { text: result } }] },
      { text: 'Private completion' },
    ],
  });
  fixtures.model.configure({
    marker: otherMarker,
    replies: [
      { tools: [{ id: randomUUID(), name: 'console_message', input: { text: otherMarker } }] },
      { text: 'Private completion' },
    ],
  });

  await sendNotificationAndWait({ ...owner, text: marker });
  await sendNotificationAndWait({ ...owner, text: otherMarker });
  await stack.restart({
    signal: 'SIGKILL',
    environment: {
      MECHANE_NOTIFICATION_PRODUCERS: JSON.stringify([
        {
          id: producer.id,
          secret: producer.signingSecret,
          recipients: [{ workspaceId: account.workspaceId, mechId: mech.id }],
        },
      ]),
    },
  });

  const delivery = {
    origin: stack.origin,
    workspaceId: account.workspaceId,
    mechId: mech.id,
    notificationId,
    producerId: producer.id,
    signingSecret: producer.signingSecret,
    body: {
      text: `${marker}: the external request completed`,
      source: { name: 'external-result', eventId: requestId },
      data: { requestId, status: 'ready' },
    },
  };

  const responses = await Promise.all([deliverNotification(delivery), deliverNotification(delivery)]);

  assert.ok(responses.every((response) => response.ok));
  await waitForTurn({ ...owner, notificationId });

  const conversation = await readConsoleMessages(owner);

  const published = conversation.messages
    .filter((message) => message.role === 'assistant')
    .map((message) => message.text);

  assert.deepEqual(new Set(published), new Set([otherMarker, result]));
  assert.equal(published.filter((text) => text === result).length, 1);
  assert.equal(fixtures.model.readCalls({ marker }).length, EXTERNAL_RESULT_MODEL_CALLS);

  const resumed = fixtures.model.readCalls({ marker })[1];

  assert.ok(resumed !== undefined);
  assert.ok(JSON.stringify(resumed.body).includes(requestId), 'The notification lost its external result identity');
}
