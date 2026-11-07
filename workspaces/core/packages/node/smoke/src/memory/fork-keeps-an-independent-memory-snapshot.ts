import { Mech, MemoryList, TurnStatus } from '@mechane/protocol';
import { createAccount, createMech, requireFixtures, runCli, sendInbox, waitForTurn } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function forkKeepsAnIndependentMemorySnapshot({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack });
  const firstMarker = `parent-memory-${randomUUID()}`;
  const laterMarker = `later-memory-${randomUUID()}`;
  const mech = await createMech({ stack, account, name: firstMarker });
  const fixtures = requireFixtures(stack);
  const path = `snapshot/${randomUUID()}`;

  const writes = [
    { marker: firstMarker, expectedVersion: null },
    { marker: laterMarker, expectedVersion: 1 },
  ];

  for (const write of writes) {
    fixtures.model.configure({
      marker: write.marker,
      replies: [
        {
          tools: [
            {
              id: randomUUID(),
              name: 'memory_write',
              input: { path, text: write.marker, expectedVersion: write.expectedVersion },
            },
          ],
        },
        { text: 'Saved' },
      ],
    });
  }

  const input = { stack, account, mechId: mech.id };
  const first = await sendInbox({ ...input, text: firstMarker });
  const firstTurn = await waitForTurn({ ...input, inboxItemId: first.id });

  assert.equal(firstTurn.status, TurnStatus.Answered);

  const fork = await runCli({
    stack,
    account,
    args: ['mech', 'fork', mech.id, '--name', `fork-${randomUUID()}`, '--workspace', account.workspaceId],
    schema: Mech,
  });

  const later = await sendInbox({ ...input, text: laterMarker });
  const laterTurn = await waitForTurn({ ...input, inboxItemId: later.id });

  assert.equal(laterTurn.status, TurnStatus.Answered);

  const parentMemories = await runCli({
    stack,
    account,
    args: ['memory', 'list', mech.id, '--workspace', account.workspaceId],
    schema: MemoryList,
  });

  const forkMemories = await runCli({
    stack,
    account,
    args: ['memory', 'list', fork.id, '--workspace', account.workspaceId],
    schema: MemoryList,
  });

  assert.equal(parentMemories.memories.find((memory) => memory.path === path)?.text, laterMarker);
  assert.equal(forkMemories.memories.find((memory) => memory.path === path)?.text, firstMarker);
}
