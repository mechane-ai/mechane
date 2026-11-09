import { Event, EventType, TurnStatus } from '@mechane/protocol';
import type { ModelFixture } from '@mechane/stack';
import {
  checkpointSandbox,
  createAccount,
  createMech,
  deleteSandbox,
  readConsoleMessages,
  readEvents,
  readModelToolResult,
  readSandboxCompletion,
  readSandboxMachines,
  readTurns,
  repeatSandboxCompletion,
  requireFixtures,
  runBash,
  sendNotification,
  upgradeSandbox,
  waitFor,
  waitForSandboxFile,
  waitForTurn,
} from '@mechane/testing';
import type { MechContext, ScenarioInput } from '@mechane/testing';
import { Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const StartedProcess = Schema.Struct({
  status: Schema.Literal('running'),
  processId: Schema.String,
  machineId: Schema.String,
});

const FAILED_ACTIVATION_STATUSES: ReadonlySet<TurnStatus> = new Set([TurnStatus.Failed, TurnStatus.Stopped]);

export async function backgroundCompletionWakesOnce({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack });
  const marker = `background-${randomUUID()}`;
  const published = `finished-${randomUUID()}`;
  const mech = await createMech({ stack, account, name: marker });
  const owner = { stack, account, mechId: mech.id };
  const { model } = requireFixtures(stack);
  const directory = `.smoke-${randomUUID()}`;
  const toolCallId = randomUUID();
  const machines = await readSandboxMachines(stack);
  const failures: Array<unknown> = [];

  const unallocated = await checkpointSandbox(owner);

  assert.equal(unallocated._tag, 'Unallocated');
  assert.deepEqual(await readSandboxMachines(stack), machines, 'A context checkpoint allocated an unused computer');

  const command = [
    `mkdir -p '${directory}'`,
    `printf started > '${directory}/started'`,
    `while [ ! -f '${directory}/release' ]; do sleep 0.05; done`,
    `printf finished > '${directory}/finished'`,
  ].join('\n');

  model.configure({
    marker,
    replies: [
      { tools: [{ id: toolCallId, name: 'start_process', input: { command } }] },
      { text: 'The process can finish later' },
    ],
  });

  try {
    const sent = await sendNotification({ ...owner, text: marker });
    const started = Schema.decodeUnknownSync(StartedProcess)(await readModelToolResult({ model, marker, toolCallId }));

    await waitForTurn({ ...owner, notificationId: sent.id });

    const gate = await waitForSandboxFile({ stack, path: join(directory, 'started'), contents: 'started' });

    model.configure({
      marker: started.processId,
      replies: [
        { tools: [{ id: randomUUID(), name: 'console_message', input: { text: published } }] },
        { text: 'Private completion' },
      ],
    });

    const foreground = await runBash({ ...owner, command: `test ! -f '${directory}/finished' && printf concurrent` });

    assert.equal(foreground.result.status, 'completed', foreground.result.message);
    assert.equal(foreground.result.output, 'concurrent');
    await writeFile(join(dirname(gate), 'release'), 'continue');
    await waitForSandboxFile({ stack, path: join(directory, 'finished'), contents: 'finished' });

    await waitFor({
      name: 'the idle mech to receive its background completion',
      read: () => readConsoleMessages(owner),
      accept: (page) => page.messages.some((message) => message.role === 'assistant' && message.text === published),
    });

    const receipt = await waitFor({
      name: 'the completed process receipt',
      read: () => readSandboxCompletion({ ...owner, executionId: started.processId }),
      accept: (observed) => observed !== null,
    });

    assert.ok(receipt !== null);
    assert.equal(receipt.status, 'exited');

    const repeated = await Promise.all([
      repeatSandboxCompletion({ ...owner, receipt }),
      repeatSandboxCompletion({ ...owner, receipt }),
    ]);

    assert.ok(repeated.every((response) => response.ok));

    const activity = await readEvents(owner);

    const completions = activity.events.filter(
      (event) =>
        Schema.is(Event)(event) &&
        event.type === EventType.NotificationReceived &&
        event.source.eventId === started.processId,
    );

    assert.equal(completions.length, 1, 'A repeated callback admitted another completion notification');

    const conversation = await readConsoleMessages(owner);

    assert.equal(conversation.messages.filter((message) => message.text === published).length, 1);

    await waitFor({
      name: 'the successful completion activation to commit its files',
      read: () => readTurns(owner),
      accept: (turns) => {
        const failure = turns.find((turn) => FAILED_ACTIVATION_STATUSES.has(turn.status));

        assert.equal(failure, undefined, 'The background lifecycle ended before committing its files');

        return turns.every((turn) => turn.status === TurnStatus.Completed);
      },
    });
    await assertLostWriterIsFenced({ ...owner, model, directory });
  } catch (error) {
    failures.push(error);
  } finally {
    await deleteSandbox(owner).catch((error: unknown) => failures.push(error));
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, 'The background lifecycle or its sandbox cleanup failed');
  }
}

type LostWriterInput = MechContext & { readonly model: ModelFixture; readonly directory: string };

async function assertLostWriterIsFenced(input: LostWriterInput): Promise<void> {
  const { stack, model, directory } = input;
  const operationId = randomUUID();

  const saved = await waitFor({
    name: 'the prior home generation to commit',
    read: () => checkpointSandbox({ ...input, operationId }),
    accept: (result) => result._tag !== 'Pending',
  });

  assert.equal(saved._tag, 'Committed');

  const marker = `lost-writer-${randomUUID()}`;
  const toolCallId = randomUUID();

  const command = [
    `printf ready > '${directory}/writer-ready'`,
    `while [ ! -f '${directory}/writer-release' ]; do sleep 0.05; done`,
    `printf unsaved > '${directory}/unsaved'`,
    'while :; do sleep 1; done',
  ].join('\n');

  model.configure({
    marker,
    replies: [
      { tools: [{ id: toolCallId, name: 'start_process', input: { command } }] },
      { isHeld: true, text: 'The managed writer remains active' },
    ],
  });

  const sent = await sendNotification({ ...input, text: marker });
  const started = Schema.decodeUnknownSync(StartedProcess)(await readModelToolResult({ model, marker, toolCallId }));

  try {
    const ready = await waitForSandboxFile({ stack, path: join(directory, 'writer-ready'), contents: 'ready' });

    await writeFile(join(dirname(ready), 'writer-release'), 'continue');
    await waitForSandboxFile({ stack, path: join(directory, 'unsaved'), contents: 'unsaved' });
    assert.ok(stack.sandbox !== undefined);
    await stack.sandbox.loseMachine(started.machineId);
  } finally {
    model.release({ marker, index: 1 });
  }

  const failed = await waitForTurn({ ...input, notificationId: sent.id });
  const afterLoss = await checkpointSandbox(input);

  assert.equal(failed.status, TurnStatus.Failed, 'The activation accepted an older home generation after machine loss');
  assert.equal(afterLoss._tag, 'Failed');

  const blockedMarker = `blocked-after-loss-${randomUUID()}`;

  model.configure({ marker: blockedMarker, replies: [{ text: 'This inference must not run' }] });

  const blocked = await sendNotification({ ...input, text: blockedMarker });
  const blockedTurn = await waitForTurn({ ...input, notificationId: blocked.id });

  assert.equal(blockedTurn.status, TurnStatus.Failed);
  assert.equal(model.readCalls({ marker: blockedMarker }).length, 0, 'Inference bypassed the failed file checkpoint');

  await upgradeSandbox(input);

  const restored = await runBash({
    ...input,
    command: `test ! -f '${directory}/unsaved' && cat '${directory}/finished'`,
  });

  assert.equal(restored.turn.status, TurnStatus.Completed);
  assert.equal(restored.result.output, 'finished', 'Recovery lost committed files or claimed an unsaved write');
}
