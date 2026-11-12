import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { defineTask } from '@earendil-works/pi-durable';
import type { TaskId, Tx } from '@earendil-works/pi-durable';
import { StoreConflict } from '@mechane/control-store';
import { RequestInvalid, RoutineStatus } from '@mechane/protocol';
import { recordIdFromDigest } from '@mechane/records';
import { Duration } from 'effect';
import type {
  ActorNotification,
  ActorPage,
  ActorPageInput,
  ActorRoutine,
  DeleteRoutineInput,
  PutRoutineInput,
} from '../actor/client.ts';
import { RoutineDeliveries, Routines } from '../actor/collections.ts';
import { decodeStored, RoutineRecord } from '../actor/records.ts';
import { fingerprint, State } from '../actor/state.ts';
import type { ActorAccess } from '../actor/types.ts';
import { admitInTransaction, appendEvent } from '../notifications/admission.ts';
import { abortNotificationTask } from './abort-notification-task.ts';

const ROUTINE_RETRY_DELAY = Duration.seconds(30);
const ROUTINE_PAGE_MAX_ROWS = 50;

type RoutineTaskInput = {
  readonly id: string;
  readonly revision: number;
  readonly text: string;
  readonly anchorAt: number;
  readonly everySeconds: number;
};

type RoutineCheckpoint = { readonly phase: 'deliver'; readonly dueAt: number };
type RoutineIdentity = { readonly routineId: string };

type RoutineMutation = {
  readonly access: ActorAccess;
  readonly principalId: string;
  readonly run: (transaction: Tx) => Promise<RoutineMutationResult>;
};

type RoutineMutationResult = { readonly routine: ActorRoutine; readonly obsoleteTaskId: TaskId | null };
type RoutineSchedule = { readonly status: ActorRoutine['status']; readonly nextDueAt: string | null };
type RoutineScheduleInput = { readonly isEnabled: boolean; readonly dueAt: number };

export const RoutineTask = defineTask<RoutineTaskInput, RoutineCheckpoint, null>({
  name: 'mechane.routine',
  version: 1,
  initial: (input) => ({
    phase: 'deliver',
    dueAt: input.anchorAt + Duration.toMillis(Duration.seconds(input.everySeconds)),
  }),
  phases: {
    deliver: async (task, runtime, context) => {
      const now = runtime.now();

      if (now < task.state.checkpoint.dueAt) {
        await runtime.sleepUntil(task.state.checkpoint.dueAt, task.state.checkpoint, context);

        return;
      }

      const conversation = await runtime.conversation(runtime.conversationId, context);

      if (conversation === undefined) {
        throw new Error('The routine conversation is missing');
      }

      await runtime.commit(async (transaction) => {
        const row = await Routines.read(transaction, task.input.id);

        if (row === undefined) {
          throw new Error('The durable routine receipt is missing');
        }

        const routine = decodeStored(RoutineRecord, row.value);

        if (routine.revision !== task.input.revision || routine.status !== RoutineStatus.Enabled) {
          return { status: 'terminal', outcome: { status: 'completed', result: null } };
        }

        const state = await transaction.doc(State);
        const admittedAt = runtime.now();

        if (state.isQuiesced || state.isPolicyPaused || !state.isImportComplete) {
          return {
            status: 'sleeping',
            until: admittedAt + Duration.toMillis(ROUTINE_RETRY_DELAY),
            checkpoint: task.state.checkpoint,
          };
        }

        const intervalMilliseconds = Duration.toMillis(Duration.seconds(task.input.everySeconds));
        const slot = Math.max(1, Math.floor((admittedAt - task.input.anchorAt) / intervalMilliseconds));
        const dueAt = task.input.anchorAt + slot * intervalMilliseconds;
        const nextDueAt = dueAt + intervalMilliseconds;
        const identity = { routineId: task.input.id, revision: task.input.revision, slot };

        const notificationId = recordIdFromDigest({
          digest: await fingerprint({ kind: 'routine', scope: state.scope, ...identity }),
        });

        const notification: ActorNotification = {
          id: notificationId,
          text: task.input.text,
          source: { name: 'routine', eventId: `${task.input.id}:${task.input.revision}:${slot}` },
          producer: { kind: 'producer', id: 'mechane-routine' },
          data: { ...identity, dueAt: new Date(dueAt).toISOString() },
        };

        const digest = await fingerprint(notification);

        await admitInTransaction({ transaction, conversation, notification, digest });
        await RoutineDeliveries.put(transaction, notificationId, {
          routineId: task.input.id,
          dueAt: new Date(dueAt).toISOString(),
        });

        const delivered: ActorRoutine = {
          ...routine,
          nextDueAt: new Date(nextDueAt).toISOString(),
          lastDueAt: new Date(dueAt).toISOString(),
          lastDeliveredAt: new Date(admittedAt).toISOString(),
          lastNotificationId: notificationId,
        };

        await Routines.put(transaction, row.id, { ...row, value: JSON.stringify(delivered) });
        await appendEvent(transaction, {
          type: 'routine.delivered',
          runId: null,
          payload: { ...identity, notificationId, dueAt: delivered.lastDueAt, nextDueAt: delivered.nextDueAt },
        });

        return { status: 'sleeping', until: nextDueAt, checkpoint: { phase: 'deliver', dueAt: nextDueAt } };
      }, context);
    },
  },
  abort: abortNotificationTask,
});

async function mutateRoutine({ access, principalId, run }: RoutineMutation): Promise<ActorRoutine> {
  await access.arm();

  const result = await access.withControl(
    async (store) =>
      await store.withMemberAdmission({
        ...access.scope,
        principalId,
        run: async (authorize) =>
          await access.conversation.commit(async (transaction) => {
            await authorize();

            return await run(transaction);
          }, BACKGROUND_CONTEXT),
      }),
  );

  if (result.obsoleteTaskId !== null) {
    await access.harness.abortTask(result.obsoleteTaskId, BACKGROUND_CONTEXT);
  }

  if (access.isDefinitionReady()) {
    access.harness.resume();
  }

  return result.routine;
}

export async function putRoutine(access: ActorAccess, input: PutRoutineInput): Promise<ActorRoutine> {
  const { principalId, ...intent } = input;
  const digest = await fingerprint(intent);

  return await mutateRoutine({
    access,
    principalId,
    run: async (transaction) => {
      const row = await Routines.read(transaction, input.routineId);
      const previous: { routine: ActorRoutine | undefined } = { routine: undefined };

      if (row !== undefined) {
        previous.routine = decodeStored(RoutineRecord, row.value);
      }

      if (previous.routine?.revision === input.expectedRevision + 1 && row?.digest === digest) {
        return { routine: previous.routine, obsoleteTaskId: null };
      }

      if ((previous.routine?.revision ?? 0) !== input.expectedRevision) {
        throw new StoreConflict('The routine revision has changed');
      }

      const state = await transaction.doc(State);

      if (state.isQuiesced) {
        throw new RequestInvalid({ reason: 'The mech is quiesced' });
      }

      const now = Date.now();
      const at = new Date(now).toISOString();
      const intervalMilliseconds = Duration.toMillis(Duration.seconds(input.everySeconds));

      const scheduling = routineSchedule({ isEnabled: input.isEnabled, dueAt: now + intervalMilliseconds });

      const routine: ActorRoutine = {
        id: input.routineId,
        mechId: access.scope.mechId,
        revision: input.expectedRevision + 1,
        name: input.name,
        text: input.text,
        everySeconds: input.everySeconds,
        status: scheduling.status,
        createdAt: previous.routine?.createdAt ?? at,
        updatedAt: at,
        anchorAt: at,
        nextDueAt: scheduling.nextDueAt,
        lastDueAt: previous.routine?.lastDueAt ?? null,
        lastDeliveredAt: previous.routine?.lastDeliveredAt ?? null,
        lastNotificationId: previous.routine?.lastNotificationId ?? null,
        lastObservedAt: previous.routine?.lastObservedAt ?? null,
        lastObservedDueAt: previous.routine?.lastObservedDueAt ?? null,
        lastObservedNotificationId: previous.routine?.lastObservedNotificationId ?? null,
        lastObservedRunId: previous.routine?.lastObservedRunId ?? null,
      };

      const task: { id: TaskId | null } = { id: null };

      if (input.isEnabled) {
        task.id = await transaction.createTask(
          RoutineTask,
          {
            id: routine.id,
            revision: routine.revision,
            text: routine.text,
            anchorAt: now,
            everySeconds: routine.everySeconds,
          },
          { ownership: { kind: 'conversation' }, background: true },
        );
      }

      await Routines.put(transaction, routine.id, {
        id: routine.id,
        taskId: task.id,
        digest,
        value: JSON.stringify(routine),
      });
      await appendEvent(transaction, {
        type: 'routine.updated',
        runId: null,
        payload: { routineId: routine.id, revision: routine.revision, status: routine.status },
      });

      return { routine, obsoleteTaskId: row?.taskId ?? null };
    },
  });
}

export async function deleteRoutine(access: ActorAccess, input: DeleteRoutineInput): Promise<ActorRoutine> {
  const { principalId, ...intent } = input;
  const digest = await fingerprint({ kind: 'delete', ...intent });

  return await mutateRoutine({
    access,
    principalId,
    run: async (transaction) => {
      const row = await Routines.read(transaction, input.routineId);

      if (row === undefined) {
        throw new RequestInvalid({ reason: 'The routine does not exist' });
      }

      const previous = decodeStored(RoutineRecord, row.value);

      if (previous.revision === input.expectedRevision + 1 && row.digest === digest) {
        return { routine: previous, obsoleteTaskId: null };
      }

      if (previous.revision !== input.expectedRevision) {
        throw new StoreConflict('The routine revision has changed');
      }

      const routine: ActorRoutine = {
        ...previous,
        revision: previous.revision + 1,
        status: RoutineStatus.Deleted,
        updatedAt: new Date().toISOString(),
        nextDueAt: null,
      };

      await Routines.put(transaction, row.id, { id: row.id, taskId: null, digest, value: JSON.stringify(routine) });
      await appendEvent(transaction, {
        type: 'routine.deleted',
        runId: null,
        payload: { routineId: routine.id, revision: routine.revision },
      });

      return { routine, obsoleteTaskId: row.taskId };
    },
  });
}

export async function readRoutine(access: ActorAccess, input: RoutineIdentity): Promise<ActorRoutine | null> {
  const row = await Routines.get(access.harness, input.routineId, BACKGROUND_CONTEXT);

  if (row === undefined) {
    return null;
  }

  return decodeStored(RoutineRecord, row.value);
}

export async function listRoutines(access: ActorAccess, input: ActorPageInput): Promise<ActorPage<ActorRoutine>> {
  const page = await Routines.page(
    access.harness,
    { after: input.after ?? undefined, maxRows: ROUTINE_PAGE_MAX_ROWS },
    BACKGROUND_CONTEXT,
  );

  return { items: page.items.map((row) => decodeStored(RoutineRecord, row.value)), hasMore: page.hasMore };
}

export async function observeRoutines(transaction: Tx, ids: ReadonlyArray<string>, runId: string): Promise<void> {
  for (const id of ids) {
    await observeRoutine(transaction, id, runId);
  }
}

function routineSchedule({ isEnabled, dueAt }: RoutineScheduleInput): RoutineSchedule {
  if (isEnabled) {
    return { status: RoutineStatus.Enabled, nextDueAt: new Date(dueAt).toISOString() };
  }

  return { status: RoutineStatus.Disabled, nextDueAt: null };
}

async function observeRoutine(transaction: Tx, id: string, runId: string): Promise<void> {
  const input = await RoutineDeliveries.read(transaction, id);

  if (input === undefined) {
    return;
  }

  const row = await Routines.read(transaction, input.routineId);

  if (row === undefined) {
    throw new Error('The observed routine receipt is missing');
  }

  const routine = decodeStored(RoutineRecord, row.value);

  if (routine.lastObservedDueAt !== null && routine.lastObservedDueAt >= input.dueAt) {
    return;
  }

  const observed: ActorRoutine = {
    ...routine,
    lastObservedAt: new Date().toISOString(),
    lastObservedDueAt: input.dueAt,
    lastObservedNotificationId: id,
    lastObservedRunId: runId,
  };

  await Routines.put(transaction, row.id, { ...row, value: JSON.stringify(observed) });
}
