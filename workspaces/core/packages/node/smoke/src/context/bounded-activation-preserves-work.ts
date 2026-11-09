import { Allowance, DispatchStatus, TurnStatus } from '@mechane/protocol';
import {
  createAccount,
  createMech,
  readConsoleMessages,
  readTrace,
  readTurns,
  requireFixtures,
  runCli,
  sendNotification,
  waitFor,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { DateTime, Option } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const TOOL_STEPS = 65;
const PRIVATE_STEP_CHARACTERS = 500;
const CHARGE_PER_MODEL_CALL_MICROS = 60;

export async function boundedActivationPreservesWork({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack });
  const marker = `bounded-work-${randomUUID()}`;
  const publication = `complete-${randomUUID()}`;
  const mech = await createMech({ stack, account, name: marker });
  const owner = { stack, account, mechId: mech.id };
  const { model } = requireFixtures(stack);
  const toolIds = Array.from({ length: TOOL_STEPS }, () => randomUUID());
  const publicationId = randomUUID();

  const replies = [
    ...toolIds.map((id) => ({
      text: `private-${marker}`.padEnd(PRIVATE_STEP_CHARACTERS, 'x'),
      tools: [{ id, name: 'list_processes', input: {} }],
    })),
    { tools: [{ id: publicationId, name: 'console_message', input: { text: publication } }] },
    { text: 'Private completion' },
  ];

  model.configure({ marker, replies, summary: `${marker}: continue from the recorded tool results.` });

  const before = await runCli({
    stack,
    account,
    args: ['allowance', 'show', '--workspace', account.workspaceId],
    schema: Allowance,
  });

  await sendNotification({ ...owner, text: marker });
  await waitFor({
    name: 'the bounded activations to finish their original work',
    read: () => readConsoleMessages(owner),
    accept: (page) => page.messages.some((message) => message.role === 'assistant' && message.text === publication),
  });

  const runs = await waitFor({
    name: 'the final bounded activation to commit',
    read: () => readTurns(owner),
    accept: (items) => items.length > 1 && items.every((turn) => turn.status === TurnStatus.Completed),
  });

  const chronological = runs.toSorted(
    (left, right) => DateTime.toEpochMillis(left.createdAt) - DateTime.toEpochMillis(right.createdAt),
  );

  for (const [index, run] of chronological.entries()) {
    const previous = chronological[index - 1];

    if (previous !== undefined && previous.status === TurnStatus.Completed) {
      assert.ok(
        DateTime.toEpochMillis(previous.endedAt) <= DateTime.toEpochMillis(Option.getOrThrow(run.startedAt)),
        'Two activations owned the same mech concurrently',
      );
    }
  }

  const traces = await Promise.all(runs.map((turn) => readTrace({ ...owner, turnId: turn.id })));
  const observedTools = traces.flatMap((trace) => trace.toolCalls?.map((tool) => tool.id) ?? []);
  const dispatches = traces.flatMap((trace) => trace.dispatches);
  const calls = model.readCalls({ marker });

  assert.deepEqual(new Set(observedTools), new Set([...toolIds, publicationId]));
  assert.equal(observedTools.length, toolIds.length + 1, 'A context handoff repeated a tool effect');
  assert.equal(calls.filter((call) => call.body['stream'] === true).length, replies.length);
  assert.ok(
    calls.some((call) => call.body['stream'] !== true),
    'The bounded flow did not exercise context summarization',
  );
  assert.equal(dispatches.length, calls.length);
  assert.ok(dispatches.every((dispatch) => dispatch.status === DispatchStatus.Settled));

  const after = await runCli({
    stack,
    account,
    args: ['allowance', 'show', '--workspace', account.workspaceId],
    schema: Allowance,
  });

  assert.equal(after.committedMicros - before.committedMicros, calls.length * CHARGE_PER_MODEL_CALL_MICROS);

  const conversation = await readConsoleMessages(owner);

  assert.deepEqual(
    conversation.messages.filter((message) => message.role === 'assistant').map((message) => message.text),
    [publication],
  );
}
