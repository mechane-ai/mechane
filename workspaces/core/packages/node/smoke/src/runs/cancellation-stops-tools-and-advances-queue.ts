import { MemoryList, TurnCancel, TurnStatus, UnansweredReason } from '@mechane/protocol';
import {
  createAccount,
  createMech,
  readTurns,
  requireFixtures,
  runCli,
  sendInbox,
  waitFor,
  waitForTurn,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function cancellationStopsToolsAndAdvancesQueue({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack });
  const marker = `cancelled-${randomUUID()}`;
  const nextMarker = `queued-${randomUUID()}`;
  const mech = await createMech({ stack, account, name: marker });
  const fixtures = requireFixtures(stack);
  const path = `cancellation/${randomUUID()}`;

  fixtures.model.configure({
    marker,
    replies: [
      {
        isHeld: true,
        tools: [{ id: randomUUID(), name: 'memory_write', input: { path, text: marker, expectedVersion: null } }],
      },
    ],
  });
  fixtures.model.configure({ marker: nextMarker, replies: [{ text: nextMarker }] });

  const input = { stack, account, mechId: mech.id };
  const sent = await sendInbox({ ...input, text: marker });

  await fixtures.model.waitForCall({ marker, index: 0 });

  const next = await sendInbox({ ...input, text: nextMarker });

  const turns = await waitFor({
    name: 'the running input to become inspectable',
    read: () => readTurns(input),
    accept: (items) =>
      items.some((turn) => turn.inboxItemIds.some((id) => id === sent.id) && turn.status === TurnStatus.Running),
  });

  const running = turns.find((turn) => turn.inboxItemIds.some((id) => id === sent.id));

  assert.ok(running !== undefined);

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

  const cancelled = await waitForTurn({ ...input, inboxItemId: sent.id });
  const completed = await waitForTurn({ ...input, inboxItemId: next.id });

  if (cancelled.status !== TurnStatus.Unanswered) {
    throw new Error('Cancellation did not end the active run');
  }

  assert.equal(cancelled.reason, UnansweredReason.Canceled);
  assert.equal(completed.status, TurnStatus.Answered);

  const memories = await runCli({
    stack,
    account,
    args: ['memory', 'list', mech.id, '--workspace', account.workspaceId],
    schema: MemoryList,
  });

  assert.equal(
    memories.memories.some((memory) => memory.path === path),
    false,
  );
}
