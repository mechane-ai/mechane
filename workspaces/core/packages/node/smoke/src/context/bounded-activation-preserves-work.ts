import { Allowance, Dispatch, DispatchStatus, TurnStatus } from '@mechane/protocol';
import {
  createAccount,
  createMech,
  readConsoleMessages,
  readHistoryPage,
  readTrace,
  readTurns,
  requireFixtures,
  runCli,
  sendNotificationAndWait,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Option, Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const TOOL_STEPS = 33;
const PRIVATE_STEP_CHARACTERS = 8192;
const MODEL_CONTEXT_MAX_BYTES = 131_072;

export async function boundedActivationPreservesWork({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack });
  const marker = `bounded-work-${randomUUID()}`;
  const publication = `complete-${randomUUID()}`;
  const firstMemory = `oldest-private-${randomUUID()}`;
  const summary = `${marker}: retained-summary-${randomUUID()}`;
  const mech = await createMech({ stack, account, name: marker });
  const owner = { stack, account, mechId: mech.id };
  const { model } = requireFixtures(stack);
  const toolIds = Array.from({ length: TOOL_STEPS }, () => randomUUID());
  const publicationId = randomUUID();

  const replies = [
    ...toolIds.map((id, index) => ({
      text: `${firstMemory}-${index}`.padEnd(PRIVATE_STEP_CHARACTERS, 'x'),
      tools: [{ id, name: 'list_processes', input: {} }],
    })),
    { tools: [{ id: publicationId, name: 'console_message', input: { text: publication } }] },
    { text: 'Private completion' },
  ];

  model.configure({ marker, replies, summary });

  const before = await runCli({
    stack,
    account,
    args: ['allowance', 'show', '--workspace', account.workspaceId],
    schema: Allowance,
  });

  const completed = await sendNotificationAndWait({ ...owner, text: marker });

  assert.equal(completed.status, TurnStatus.Completed);

  const turns = await readTurns(owner);
  const trace = await readTrace({ ...owner, turnId: completed.id });
  const observedTools = trace.toolCalls?.map((tool) => tool.id) ?? [];
  const calls = model.readCalls({ marker });
  const generations = calls.filter((call) => call.purpose === 'generation');
  const compactions = calls.filter((call) => call.purpose === 'compaction');

  assert.equal(turns.length, 1, 'Native compaction started another execution owner');
  assert.deepEqual(new Set(observedTools), new Set([...toolIds, publicationId]));
  assert.equal(observedTools.length, toolIds.length + 1, 'Compaction repeated a tool effect');
  assert.equal(generations.length, replies.length);
  assert.ok(compactions.length > 0, 'The flow did not execute native compaction');

  const firstPage = await readHistoryPage(owner);

  assert.equal(firstPage.hasMore, true, 'Native history was not paged');

  const after = Option.getOrThrow(firstPage.nextCursor);
  const secondPage = await readHistoryPage({ ...owner, after });
  const history = [...firstPage.entries, ...secondPage.entries];

  assert.equal(secondPage.hasMore, false);
  assert.equal(new Set(history.map((entry) => entry.id)).size, history.length, 'History paging repeated an entry');
  assert.ok(history.some((entry) => entry.kind === 'pi.compaction' && entry.text.includes(summary)));
  assert.ok(
    history.some((entry) => entry.text.includes(`${firstMemory}-0`)),
    'Compaction discarded older native history',
  );

  const continued = generations.at(-1);

  assert.ok(continued !== undefined);

  const workingContext = JSON.stringify(continued.body['messages']);

  assert.ok(workingContext.includes(summary), 'The provider did not receive the committed native summary');
  assert.equal(
    workingContext.includes(`${firstMemory}-0`),
    false,
    'The provider received lifetime history after compaction',
  );
  assert.ok(
    generations.every((call) => Buffer.byteLength(JSON.stringify(call.body['messages'])) <= MODEL_CONTEXT_MAX_BYTES),
    'A provider request exceeded the fixture model context bound',
  );
  assert.equal(trace.dispatches.length, calls.length, 'A generation or compaction has no admitted spend reservation');
  assert.equal(new Set(trace.dispatches.map((dispatch) => dispatch.id)).size, calls.length);

  const settledMicros = trace.dispatches.map((dispatch) => {
    if (!Schema.is(Dispatch)(dispatch) || dispatch.status !== DispatchStatus.Settled) {
      throw new Error('A completed provider attempt has no settled usage');
    }

    return dispatch.settledMicros;
  });

  const afterAllowance = await runCli({
    stack,
    account,
    args: ['allowance', 'show', '--workspace', account.workspaceId],
    schema: Allowance,
  });

  assert.equal(
    afterAllowance.committedMicros - before.committedMicros,
    settledMicros.reduce((total, charge) => total + charge, 0),
  );

  const conversation = await readConsoleMessages(owner);

  assert.deepEqual(
    conversation.messages.filter((message) => message.role === 'assistant').map((message) => message.text),
    [publication],
  );

  await stack.restart({ signal: 'SIGKILL' });

  assert.deepEqual(await readHistoryPage(owner), firstPage);
  assert.deepEqual(await readHistoryPage({ ...owner, after }), secondPage);
  assert.equal(model.readCalls({ marker }).length, calls.length, 'History inspection repeated paid work');
}
