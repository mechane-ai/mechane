import { Event, EventType, TurnStatus } from '@mechane/protocol';
import { HttpStatusCode } from '@mechane/records';
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
  startCommandGate,
  waitFor,
  waitForTurn,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { Option, Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const AdmittedProcess = Schema.Struct({ status: Schema.Literals(['pending', 'running']), processId: Schema.String });

const FAILED_ACTIVATION_STATUSES: ReadonlySet<TurnStatus> = new Set([TurnStatus.Failed, TurnStatus.Stopped]);
const COMPLETION_MODEL_CALLS = 2;

export async function backgroundCompletionWakesOnce({ stack }: ScenarioInput): Promise<void> {
  const account = await createAccount({ stack });
  const marker = `background-${randomUUID()}`;
  const published = `finished-${randomUUID()}`;
  const idlePublished = `idle-publication-${randomUUID()}`;
  const idleMessageId = randomUUID();
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

  const gate = await startCommandGate({ stack });

  try {
    const command = [
      'set -e',
      `mkdir -p '${directory}'`,
      `curl --fail --silent '${gate.url}'`,
      `mechane self message '${idlePublished}' --message-id '${idleMessageId}' --output json >/dev/null`,
      `printf finished > '${directory}/finished'`,
    ].join('\n');

    model.configure({
      marker,
      replies: [
        { tools: [{ id: toolCallId, name: 'start_process', input: { command } }] },
        { text: 'The process can finish later' },
      ],
    });

    const sent = await sendNotification({ ...owner, text: marker });
    const started = Schema.decodeUnknownSync(AdmittedProcess)(await readModelToolResult({ model, marker, toolCallId }));

    await waitForTurn({ ...owner, notificationId: sent.id });

    await gate.waitForRequest({ count: 1 });

    model.configure({
      marker: started.processId,
      replies: [
        { tools: [{ id: randomUUID(), name: 'console_message', input: { text: published } }] },
        { text: 'Private completion' },
      ],
    });

    const foreground = await runBash({ ...owner, command: `test ! -f '${directory}/finished' && printf concurrent` });

    assert.equal(foreground.receipt.status, 'completed');
    assert.equal(foreground.result.output, 'concurrent');
    gate.release();

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
    assert.equal(Option.getOrThrow(receipt.exitCode), 0);
    assert.equal(gate.readRequests().length, 1, 'The managed process repeated its command');

    const repeated = await Promise.all([
      repeatSandboxCompletion({ ...owner, receipt }),
      repeatSandboxCompletion({ ...owner, receipt }),
    ]);

    assert.ok(repeated.every((response) => response.ok));

    const forged = await repeatSandboxCompletion({ ...owner, receipt: { ...receipt, exitCode: Option.some(1) } });

    assert.equal(forged.status, HttpStatusCode.BadRequest, 'A callback replaced its durable environment outcome');

    const activity = await readEvents(owner);

    const completions = activity.events.filter(
      (event) =>
        Schema.is(Event)(event) &&
        event.type === EventType.NotificationReceived &&
        event.source.eventId === started.processId,
    );

    assert.equal(completions.length, 1, 'A repeated callback admitted another completion notification');

    const idlePublication = activity.events.find(
      (event) =>
        Schema.is(Event)(event) && event.type === EventType.ConsoleMessage && event.messageId === idleMessageId,
    );

    assert.ok(Schema.is(Event)(idlePublication) && idlePublication.type === EventType.ConsoleMessage);
    assert.ok(Option.isNone(idlePublication.turnId), 'An idle self publication invented an activation link');

    const conversation = await readConsoleMessages(owner);

    assert.deepEqual(
      conversation.messages.filter((message) => message.role === 'assistant').map((message) => message.text),
      [idlePublished, published],
    );

    await waitFor({
      name: 'the successful completion activation to commit its files',
      read: () => readTurns(owner),
      accept: (turns) => {
        const failure = turns.find((turn) => FAILED_ACTIVATION_STATUSES.has(turn.status));

        assert.equal(failure, undefined, 'The background lifecycle ended before committing its files');

        return turns.every((turn) => turn.status === TurnStatus.Completed);
      },
    });

    const durableEvents = await readEvents(owner);

    assert.deepEqual(await readConsoleMessages(owner), conversation, 'Private completion published another message');
    await stack.restart({ signal: 'SIGKILL' });

    const replayed = await repeatSandboxCompletion({ ...owner, receipt });

    assert.ok(replayed.ok, 'Restart refused an already accepted completion receipt');
    assert.deepEqual(await readEvents(owner), durableEvents);
    assert.deepEqual(
      await readConsoleMessages(owner),
      conversation,
      'Restart repeated an idle publication or its completion',
    );
    assert.equal(
      model.readCalls({ marker: started.processId }).length,
      COMPLETION_MODEL_CALLS,
      'A replayed completion repeated model work',
    );
  } catch (error) {
    failures.push(error);
    await stack.captureFailure('backgroundCompletionWakesOnce:before-sandbox-cleanup').catch(() => undefined);
  } finally {
    gate.release();
    await gate.close().catch((error: unknown) => failures.push(error));
    await deleteSandbox(owner).catch((error: unknown) => failures.push(error));
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, 'The background lifecycle or its sandbox cleanup failed');
  }
}
