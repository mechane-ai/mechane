import {
  createMechContext,
  readConsoleMessages,
  requireFixtures,
  sendNotification,
  waitForTurn,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function quietCompletionDrainsNotifications({ stack }: ScenarioInput): Promise<void> {
  const marker = `idle-arrival-${randomUUID()}`;
  const reply = `observed-${randomUUID()}`;
  const owner = await createMechContext({ stack, name: marker });
  const { model } = requireFixtures(stack);

  model.configure({
    marker,
    replies: [
      { isHeld: true, text: 'Nothing more to do' },
      { tools: [{ id: randomUUID(), name: 'console_message', input: { text: reply } }] },
      { text: 'Private completion' },
    ],
  });

  await sendNotification({ ...owner, text: marker });
  await model.waitForCall({ marker, index: 0 });

  const arrived = await sendNotification({ ...owner, text: `${marker}: another notification` }).finally(() => {
    model.release({ marker, index: 0 });
  });

  await waitForTurn({ ...owner, notificationId: arrived.id });

  const conversation = await readConsoleMessages(owner);

  assert.deepEqual(
    conversation.messages.filter((message) => message.role === 'assistant').map((message) => message.text),
    [reply],
    'A notification arriving during a quiet completion was lost or private final text was published',
  );
}
