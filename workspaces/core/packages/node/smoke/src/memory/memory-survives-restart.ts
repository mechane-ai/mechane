import { DispatchStatus, MemoryList, TurnStatus } from '@mechane/protocol';
import { createAccount, createMech, readTrace, requireFixtures, runCli, sendInboxAndWait } from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const MEMORY_CONTEXT_CHARACTERS = 5000;

export async function memorySurvivesRestart({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack });
  const marker = `persistent-memory-${randomUUID()}`;
  const mech = await createMech({ stack, account, name: marker });
  const fixtures = requireFixtures(stack);
  const path = `knowledge/${randomUUID()}`;
  const text = marker.padEnd(MEMORY_CONTEXT_CHARACTERS, 'x');

  fixtures.model.configure({
    marker,
    replies: [
      { tools: [{ id: randomUUID(), name: 'memory_write', input: { path, text, expectedVersion: null } }] },
      { text: `Saved the memory at ${path}. Do not repeat the write. Continue the request ${marker}.` },
      { text: 'Saved' },
    ],
  });

  const input = { stack, account, mechId: mech.id };
  const turn = await sendInboxAndWait({ ...input, text: marker });

  assert.equal(turn.status, TurnStatus.Answered);

  const calls = fixtures.model.readCalls({ marker });

  assert.ok(
    calls.some((call) => call.body['stream'] !== true),
    'The large tool result did not exercise compaction',
  );

  const trace = await readTrace({ ...input, turnId: turn.id });

  assert.equal(trace.dispatches.length, calls.length);
  assert.ok(trace.dispatches.every((dispatch) => dispatch.status === DispatchStatus.Settled));

  await stack.restart();

  const memories = await runCli({
    stack,
    account,
    args: ['memory', 'list', mech.id, '--workspace', account.workspaceId],
    schema: MemoryList,
  });

  const memory = memories.memories.find((candidate) => candidate.path === path);

  assert.ok(memory !== undefined, 'The acknowledged memory is missing after restart');
  assert.equal(memory.text, text);
  assert.equal(memory.version, 1);
}
