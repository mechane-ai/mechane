import { Mech, TurnStatus } from '@mechane/protocol';
import {
  createAccount,
  createMech,
  readConsoleMessages,
  readTurns,
  requireFixtures,
  runCli,
  sendNotification,
  waitForTurn,
} from '@mechane/testing';
import type { MechContext, ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const PENDING_NOTICE_COUNT = 101;
const EXPECTED_DRAIN_CALLS = 2;

type ChangeMechState = MechContext & { readonly action: 'pause' | 'resume'; readonly expectedRevision: number };

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

  const resumed = await runCli({
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

  const pausedAgain = await changeMechState({ ...owner, action: 'pause', expectedRevision: resumed.revision });
  const batchMarker = `paused-batch-${randomUUID()}`;
  const pending = [];
  const failures: Array<unknown> = [];

  fixtures.model.configure({
    marker: batchMarker,
    replies: [
      { isHeld: true, text: 'The pending batch remains private.' },
      { text: 'The accepted correction and pending batch were observed.' },
    ],
  });

  try {
    for (let index = 0; index < PENDING_NOTICE_COUNT; index += 1) {
      const notice = await sendNotification({ ...owner, text: `${batchMarker}:${index}` });

      pending.push(notice);
    }

    assert.equal(fixtures.model.readCalls({ marker: batchMarker }).length, 0);
    await stack.restart({ signal: 'SIGKILL' });
    await changeMechState({ ...owner, action: 'resume', expectedRevision: pausedAgain.revision });
    await fixtures.model.waitForCall({ marker: batchMarker, index: 0 });

    const correction = await sendNotification({ ...owner, text: `${batchMarker}: include this accepted correction` });

    fixtures.model.release({ marker: batchMarker, index: 0 });

    const drained = await waitForTurn({ ...owner, notificationId: correction.id });
    const reconsideration = await fixtures.model.waitForCall({ marker: batchMarker, index: 1 });
    const context = JSON.stringify(reconsideration.body['messages']);

    assert.equal(drained.status, TurnStatus.Completed);
    assert.ok(context.includes(correction.id), 'The busy generation omitted the accepted correction');
    assert.equal(fixtures.model.readCalls({ marker: batchMarker }).length, EXPECTED_DRAIN_CALLS);

    for (const notice of pending) {
      assert.ok(context.includes(notice.id), 'The provider context omitted a resumed notification');
    }

    const turns = await readTurns(owner);
    const conversation = await readConsoleMessages(owner);
    const coveredIds = turns.flatMap((turn) => turn.notificationIds);
    const acceptedIds = [sent.id, ...pending.map((notice) => notice.id), correction.id];

    assert.equal(
      turns.every((turn) => turn.status === TurnStatus.Completed),
      true,
    );
    assert.deepEqual(coveredIds.toSorted(), acceptedIds.toSorted(), 'Accepted notices must each finish in one turn');
    assert.equal(
      conversation.messages.some((message) => message.role === 'assistant'),
      false,
    );
  } catch (cause) {
    failures.push(cause);
    await stack.captureFailure('paused-drain-before-release').catch((failure: unknown) => failures.push(failure));
  } finally {
    fixtures.model.release({ marker: batchMarker, index: 0 });
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, 'The resumed notification batch did not drain');
  }
}

async function changeMechState({ stack, account, mechId, action, expectedRevision }: ChangeMechState): Promise<Mech> {
  return await runCli({
    stack,
    account,
    args: ['mech', action, mechId, '--workspace', account.workspaceId, '--expected-revision', String(expectedRevision)],
    schema: Mech,
  });
}
