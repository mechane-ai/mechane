import { NotificationReceipt } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import {
  createAccount,
  createMech,
  deliverNotification,
  notificationPath,
  notificationProducerEnvironment,
  requireFixtures,
  waitForTurn,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const REQUEST_DEADLINE_MS = 15_000;

export async function producerIsBoundToRecipient({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack });
  const marker = `producer-${randomUUID()}`;
  const allowed = await createMech({ stack, account, name: marker });
  const other = await createMech({ stack, account, name: `other-${randomUUID()}` });
  const fixtures = requireFixtures(stack);
  const producer = fixtures.notifications;
  const notificationId = randomUUID();

  fixtures.model.configure({ marker, replies: [{ text: 'Private completion' }] });
  await stack.restart({
    environment: notificationProducerEnvironment({ workspaceId: account.workspaceId, mechId: allowed.id, producer }),
  });

  const delivery = {
    origin: stack.origin,
    workspaceId: account.workspaceId,
    mechId: allowed.id,
    notificationId,
    producerId: producer.id,
    signingSecret: producer.signingSecret,
    body: { text: marker, source: { name: 'fixture', eventId: randomUUID() } },
  };

  const invalid = await deliverNotification({ ...delivery, signingSecret: randomUUID() });
  const expired = await deliverNotification({ ...delivery, timestamp: '1' });
  const forbidden = await deliverNotification({ ...delivery, mechId: other.id });

  const retargeted = await deliverNotification({
    ...delivery,
    notificationId: randomUUID(),
    signedPath: notificationPath(delivery),
  });

  assert.equal(invalid.status, HttpStatusCode.Unauthorized);
  assert.equal(expired.status, HttpStatusCode.Unauthorized);
  assert.equal(forbidden.status, HttpStatusCode.Forbidden);
  assert.equal(retargeted.status, HttpStatusCode.Unauthorized);

  const partial = await fetch(new URL(notificationPath(delivery), stack.origin), {
    method: HttpMethod.Post,
    headers: {
      [HttpHeader.Authorization]: `Bearer ${account.token}`,
      [HttpHeader.ContentType]: MediaType.Json,
      [HttpHeader.NotificationProducer]: producer.id,
    },
    body: JSON.stringify(delivery.body),
    signal: AbortSignal.timeout(REQUEST_DEADLINE_MS),
  });

  assert.equal(
    partial.status,
    HttpStatusCode.Unauthorized,
    'Partial producer authentication fell back to member access',
  );
  assert.equal(fixtures.model.readCalls({ marker }).length, 0);

  const responses = await Promise.all([deliverNotification(delivery), deliverNotification(delivery)]);
  const receipts: Array<NotificationReceipt> = [];

  for (const response of responses) {
    assert.ok(response.ok, `The valid producer returned ${response.status}`);
    receipts.push(Schema.decodeUnknownSync(NotificationReceipt)(await response.json()));
  }

  assert.equal(receipts[0]?.id, receipts[1]?.id);
  assert.equal(receipts.filter((receipt) => receipt.wasCreated).length, 1);

  const changed = await deliverNotification({ ...delivery, body: { ...delivery.body, text: `${marker}-changed` } });

  assert.equal(changed.status, HttpStatusCode.Conflict, 'A retry replaced an immutable accepted notification');
  await waitForTurn({ stack, account, mechId: allowed.id, notificationId });
  assert.equal(fixtures.model.readCalls({ marker }).length, 1);
}
