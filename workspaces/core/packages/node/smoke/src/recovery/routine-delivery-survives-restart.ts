import { Event, EventType, Mech, Routine, RoutineStatus, TurnStatus } from '@mechane/protocol';
import {
  createMechContext,
  readConsoleMessages,
  readEvents,
  readSandboxMachines,
  readTurns,
  requireFixtures,
  runCli,
  runCliFailure,
  waitFor,
  waitForTurn,
} from '@mechane/testing';
import type { MechContext, ScenarioInput } from '@mechane/testing';
import { DateTime, Duration, Option, Schema } from 'effect';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const ROUTINE_INTERVAL = Duration.minutes(1);
const MISSED_SLOT_COUNT = 2;
const ROUTINE_WAIT_TIMEOUT = Duration.minutes(3);
type RoutineSelection = MechContext & { readonly routineId: string };

type RoutineChange = RoutineSelection & {
  readonly revision: number;
  readonly marker: string;
  readonly isEnabled: boolean;
};

export async function routineDeliverySurvivesRestart({ stack }: ScenarioInput): Promise<void> {
  const marker = `routine-${randomUUID()}`;
  const owner = await createMechContext({ stack, name: marker });
  const routineId = randomUUID();
  const selected = { ...owner, routineId };
  const { model } = requireFixtures(stack);
  const machines = await readSandboxMachines(stack);

  model.configure({ marker, replies: [{ isHeld: true, text: 'Private routine completion' }] });

  const disabled = await changeRoutine({ ...selected, revision: 0, marker, isEnabled: false });
  const repeated = await changeRoutine({ ...selected, revision: 0, marker, isEnabled: false });

  assert.deepEqual(repeated, disabled, 'A retry changed the saved routine');

  const conflict = await runCliFailure({
    ...owner,
    args: routineArguments({ ...selected, revision: 0, marker: `${marker}-changed`, isEnabled: false }),
  });

  assert.equal(conflict.code, 'RequestConflict');

  const paused = await runCli({
    ...owner,
    args: ['mech', 'pause', owner.mechId, '--workspace', owner.account.workspaceId, '--expected-revision', '1'],
    schema: Mech,
  });

  const enabled = await changeRoutine({ ...selected, revision: disabled.revision, marker, isEnabled: true });
  const anchorAt = DateTime.toEpochMillis(enabled.anchorAt);
  const secondDueAt = anchorAt + MISSED_SLOT_COUNT * Duration.toMillis(ROUTINE_INTERVAL);

  await stack.restart({ signal: 'SIGKILL' });
  await waitFor({
    name: 'two absolute routine slots while model work is paused',
    timeoutMs: Duration.toMillis(ROUTINE_WAIT_TIMEOUT),
    read: async () => {
      const routine = await showRoutine(selected);

      assert.ok(Option.isNone(routine.lastNotificationId), 'A paused mech admitted recurring work');

      return Date.now();
    },
    accept: (now) => now >= secondDueAt,
  });

  await runCli({
    ...owner,
    args: [
      'mech',
      'resume',
      owner.mechId,
      '--workspace',
      owner.account.workspaceId,
      '--expected-revision',
      String(paused.revision),
    ],
    schema: Mech,
  });
  await model.waitForCall({ marker, index: 0 });

  try {
    const observed = await showRoutine(selected);
    const notificationId = Option.getOrThrow(observed.lastNotificationId);
    const deliveredAt = DateTime.toEpochMillis(Option.getOrThrow(observed.lastDeliveredAt));
    const slot = Math.floor((deliveredAt - anchorAt) / Duration.toMillis(ROUTINE_INTERVAL));

    assert.ok(slot >= MISSED_SLOT_COUNT);
    assert.equal(
      DateTime.toEpochMillis(Option.getOrThrow(observed.lastDueAt)),
      anchorAt + slot * Duration.toMillis(ROUTINE_INTERVAL),
    );
    assert.equal(Option.getOrThrow(observed.lastObservedNotificationId), notificationId);

    const stopped = await changeRoutine({ ...selected, revision: enabled.revision, marker, isEnabled: false });

    assert.equal(stopped.status, RoutineStatus.Disabled);
    assert.equal(Option.getOrThrow(stopped.lastNotificationId), notificationId, 'Disabling discarded accepted input');

    model.release({ marker, index: 0 });

    const completed = await waitForTurn({ ...owner, notificationId });

    assert.equal(completed.status, TurnStatus.Completed);
    await stack.restart({ signal: 'SIGKILL' });

    const events = await readEvents(owner);
    const turns = await readTurns(owner);
    const conversation = await readConsoleMessages(owner);

    const received = events.events.filter(
      (event) => Schema.is(Event)(event) && event.type === EventType.NotificationReceived,
    );

    assert.equal(received.length, 1, 'Missed slots or recovery repeated paid work');
    assert.equal(model.readCalls({ marker }).length, 1);
    assert.equal(turns.length, 1);
    assert.deepEqual(conversation.messages, []);
    assert.deepEqual(await readSandboxMachines(stack), machines, 'A routine allocated a computer without a tool');

    const deletion = [
      'routine',
      'delete',
      owner.mechId,
      routineId,
      '--workspace',
      owner.account.workspaceId,
      '--revision',
      String(stopped.revision),
    ];

    const deleted = await runCli({ ...owner, args: deletion, schema: Routine });
    const deletedAgain = await runCli({ ...owner, args: deletion, schema: Routine });

    assert.equal(deleted.status, RoutineStatus.Deleted);
    assert.deepEqual(deletedAgain, deleted);
  } finally {
    model.release({ marker, index: 0 });
  }
}

function routineArguments({
  account,
  mechId,
  routineId,
  revision,
  marker,
  isEnabled,
}: RoutineChange): ReadonlyArray<string> {
  return [
    'routine',
    'put',
    mechId,
    routineId,
    '--workspace',
    account.workspaceId,
    '--revision',
    String(revision),
    '--name',
    marker,
    '--text',
    marker,
    '--every-minutes',
    '1',
    '--enabled',
    String(isEnabled),
  ];
}

async function changeRoutine(input: RoutineChange): Promise<Routine> {
  return await runCli({ ...input, args: routineArguments(input), schema: Routine });
}

async function showRoutine({ stack, account, mechId, routineId }: RoutineSelection): Promise<Routine> {
  return await runCli({
    stack,
    account,
    args: ['routine', 'show', mechId, routineId, '--workspace', account.workspaceId],
    schema: Routine,
  });
}
