import { Mech, TurnStatus } from '@mechane/protocol';
import {
  createAccount,
  createMech,
  readTurns,
  requireFixtures,
  runCli,
  sendNotification,
  waitForTurn,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function pausedAdmissionResumes({ stack }: ScenarioInput): Promise<void> {
  const fixtures = requireFixtures(stack);
  const account = await createAccount({ stack });
  const marker = `paused-${randomUUID()}`;
  const mech = await createMech({ stack, account, name: marker });
  const owner = { stack, account, mechId: mech.id };

  fixtures.model.configure({ marker, replies: [{ text: marker }] });

  const paused = await runCli({
    stack,
    account,
    args: ['mech', 'pause', mech.id, '--workspace', account.workspaceId, '--expected-revision', String(mech.revision)],
    schema: Mech,
  });

  const sent = await sendNotification({ ...owner, text: marker });

  assert.equal(fixtures.model.readCalls({ marker }).length, 0);

  const pausedRuns = await readTurns(owner);

  assert.equal(
    pausedRuns.some((turn) => turn.status === TurnStatus.Running),
    false,
  );

  await stack.restart({ signal: 'SIGKILL' });
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

  const completed = await waitForTurn({ ...owner, notificationId: sent.id });

  assert.equal(completed.status, TurnStatus.Completed);
  assert.equal(fixtures.model.readCalls({ marker }).length, 1);
}
