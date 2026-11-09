import {
  createAccount,
  createMech,
  readConsoleMessages,
  requireFixtures,
  sendNotificationAndWait,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function contextSurvivesRestart({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack });
  const marker = `persistent-context-${randomUUID()}`;
  const privateMemory = `remembered-${randomUUID()}`;
  const laterMarker = `continued-${randomUUID()}`;
  const mech = await createMech({ stack, account, name: marker });
  const { model } = requireFixtures(stack);
  const owner = { stack, account, mechId: mech.id };

  model.configure({ marker, replies: [{ text: privateMemory }] });
  model.configure({ marker: laterMarker, replies: [{ text: 'Private completion' }] });

  await sendNotificationAndWait({ ...owner, text: marker });
  await stack.restart();
  await sendNotificationAndWait({ ...owner, text: laterMarker });

  const continued = model.readCalls({ marker: laterMarker })[0];

  assert.ok(continued !== undefined);
  assert.ok(
    JSON.stringify(continued.body).includes(privateMemory),
    'The next activation lost its private context checkpoint',
  );

  const conversation = await readConsoleMessages(owner);

  assert.equal(conversation.messages.filter((message) => message.role === 'assistant').length, 0);
}
