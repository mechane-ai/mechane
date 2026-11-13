import { Event, EventType, Wake, WakeStatus } from '@mechane/protocol';
import {
  createMechContext,
  deleteSandbox,
  readConsoleMessages,
  readEvents,
  requireFixtures,
  runBash,
  waitFor,
  waitForTurn,
} from '@mechane/testing';
import type { ScenarioInput } from '@mechane/testing';
import { DateTime, Option, Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const WAKE_DELAY_SECONDS = 30;
const WAKE_MODEL_CALLS = 2;
const WakeReceipts = Schema.Struct({ scheduled: Wake, repeated: Wake, cancelled: Wake });

export async function selfWakeSurvivesRestart({ stack }: ScenarioInput): Promise<void> {
  const marker = `self-wake-${randomUUID()}`;
  const cancelledMarker = `cancelled-self-wake-${randomUUID()}`;
  const publication = `awoke-${randomUUID()}`;
  const wakeId = randomUUID();
  const cancelledWakeId = randomUUID();
  const owner = await createMechContext({ stack, name: marker });
  const { model } = requireFixtures(stack);

  model.configure({
    marker,
    replies: [
      { tools: [{ id: randomUUID(), name: 'console_message', input: { text: publication } }] },
      { text: 'Private wake completion' },
    ],
  });
  model.configure({ marker: cancelledMarker, replies: [{ text: 'A cancelled wake must not run' }] });

  const actions = [
    ['self', 'wake', 'schedule', marker, '--wake-id', wakeId, '--after-seconds', String(WAKE_DELAY_SECONDS)],
    ['self', 'wake', 'schedule', marker, '--wake-id', wakeId, '--after-seconds', String(WAKE_DELAY_SECONDS)],
    [
      'self',
      'wake',
      'schedule',
      cancelledMarker,
      '--wake-id',
      cancelledWakeId,
      '--after-seconds',
      String(WAKE_DELAY_SECONDS),
    ],
    ['self', 'wake', 'cancel', cancelledWakeId],
  ];

  const commandSource = [
    'const {execFileSync}=require("node:child_process");',
    `const actions=${JSON.stringify(actions)};`,
    'const results=actions.map((args)=>JSON.parse(execFileSync("mechane",[...args,"--output","json"],{encoding:"utf8",stdio:["ignore","pipe","pipe"]})).result);',
    'process.stdout.write(JSON.stringify({scheduled:results[0],repeated:results[1],cancelled:results[3]}));',
  ].join('');

  const failures: Array<unknown> = [];

  try {
    const scheduled = await runBash({ ...owner, command: `node -e '${commandSource}'` });

    assert.equal(scheduled.receipt.status, 'completed');
    assert.equal(Option.getOrThrow(scheduled.receipt.exitCode), 0);

    const output = Schema.decodeUnknownSync(Schema.String)(scheduled.result.output);
    const receipts = Schema.decodeUnknownSync(Schema.fromJsonString(WakeReceipts))(output);

    assert.equal(receipts.scheduled.status, WakeStatus.Scheduled);
    assert.deepEqual(receipts.repeated, receipts.scheduled, 'Retrying a relative wake moved its original deadline');
    assert.equal(receipts.cancelled.status, WakeStatus.Cancelled);
    assert.ok(
      DateTime.toEpochMillis(receipts.scheduled.dueAt) > Date.now(),
      'The fixture did not stop before the wake was due',
    );
    assert.equal(model.readCalls({ marker }).length, 0);

    await stack.restart({ signal: 'SIGKILL' });

    await waitFor({
      name: 'the native durable wake to resume after restart',
      read: () => readConsoleMessages(owner),
      accept: (page) => page.messages.some((message) => message.text === publication),
    });

    const events = await readEvents(owner);

    const received = events.events.filter(
      (event) =>
        Schema.is(Event)(event) && event.type === EventType.NotificationReceived && event.source.eventId === wakeId,
    );

    const cancelled = events.events.filter(
      (event) =>
        Schema.is(Event)(event) &&
        event.type === EventType.NotificationReceived &&
        event.source.eventId === cancelledWakeId,
    );

    assert.equal(received.length, 1);
    assert.equal(cancelled.length, 0);
    assert.equal(model.readCalls({ marker: cancelledMarker }).length, 0);

    const delivered = received[0];

    assert.ok(Schema.is(Event)(delivered) && delivered.type === EventType.NotificationReceived);
    await waitForTurn({ ...owner, notificationId: delivered.notificationId });
    await stack.restart({ signal: 'SIGKILL' });

    const conversation = await readConsoleMessages(owner);

    assert.deepEqual(
      conversation.messages.filter((message) => message.role === 'assistant').map((message) => message.text),
      [publication],
    );
    assert.equal(model.readCalls({ marker }).length, WAKE_MODEL_CALLS, 'Restart repeated a delivered wake');
  } catch (cause) {
    failures.push(cause);
    await stack.captureFailure('selfWakeSurvivesRestart:before-sandbox-cleanup').catch(() => undefined);
  }

  try {
    await deleteSandbox(owner);
  } catch (cause) {
    failures.push(cause);
  }

  if (failures.length > 0) {
    const messages = failures.map((cause) => {
      if (cause instanceof Error) {
        return cause.message;
      }

      return String(cause);
    });

    throw new AggregateError(failures, messages.join('; '));
  }
}
