import { Mech } from '@mechane/protocol';
import { createAccount, createMech, requireFixtures, runCli, sendNotificationAndWait } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function forkKeepsAnIndependentContext({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack });
  const marker = `parent-context-${randomUUID()}`;
  const originalMemory = `original-${randomUUID()}`;
  const laterMarker = `later-${randomUUID()}`;
  const laterMemory = `parent-only-${randomUUID()}`;
  const forkMarker = `fork-context-${randomUUID()}`;
  const mech = await createMech({ stack, account, name: marker });
  const { model } = requireFixtures(stack);
  const owner = { stack, account, mechId: mech.id };

  model.configure({ marker, replies: [{ text: originalMemory }] });
  model.configure({ marker: laterMarker, replies: [{ text: laterMemory }] });
  model.configure({ marker: forkMarker, replies: [{ text: 'Private completion' }] });

  await sendNotificationAndWait({ ...owner, text: marker });

  const fork = await runCli({
    stack,
    account,
    args: ['mech', 'fork', mech.id, '--name', `fork-${randomUUID()}`, '--workspace', account.workspaceId],
    schema: Mech,
  });

  await sendNotificationAndWait({ ...owner, text: laterMarker });
  await runCli({
    stack,
    account,
    args: ['mech', 'resume', fork.id, '--workspace', account.workspaceId, '--expected-revision', String(fork.revision)],
    schema: Mech,
  });
  await sendNotificationAndWait({ ...owner, mechId: fork.id, text: forkMarker });

  const continued = model.readCalls({ marker: forkMarker })[0];

  assert.ok(continued !== undefined);

  const prompt = JSON.stringify(continued.body);

  assert.ok(prompt.includes(originalMemory), 'The fork lost its initial context');
  assert.equal(prompt.includes(laterMemory), false, 'Later parent work changed the fork context');
}
