import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { defineTask } from '@earendil-works/pi-durable';
import { StoreConflict } from '@mechane/control-store';
import { RequestInvalid } from '@mechane/protocol';
import { Duration } from 'effect';
import type { ActorNotification, ActorPage, ActorPageInput, ActorWake, ScheduleWakeInput } from '../actor/client.ts';
import { Wakes } from '../actor/collections.ts';
import { decodeStored, WakeRecord as WakeRecordSchema } from '../actor/records.ts';
import { fingerprint, State } from '../actor/state.ts';
import type { ActorAccess } from '../actor/types.ts';
import { admitInTransaction, appendEvent } from '../notifications/admission.ts';
import { abortNotificationTask } from './abort-notification-task.ts';

const WAKE_RETRY_DELAY = Duration.seconds(1);
const WAKE_PAGE_DEFAULT_ROWS = 50;
const WAKE_PAGE_MAX_ROWS = 100;

type WakeInput = {
  readonly id: string;
  readonly text: string;
  readonly at: number;
  readonly notificationId: string;
  readonly digest: string;
};

type WaitingWake = { readonly phase: 'wait' };
type DeliveringWake = { readonly phase: 'deliver' };
type WakeCheckpoint = WaitingWake | DeliveringWake;
type WakeIdentity = { readonly wakeId: string };

export const SelfWakeTask = defineTask<WakeInput, WakeCheckpoint, null>({
  name: 'mechane.self-wake',
  version: 1,
  initial: () => ({ phase: 'wait' }),
  phases: {
    wait: (task, runtime, context) => runtime.sleepUntil(task.input.at, { phase: 'deliver' }, context),
    deliver: async (task, runtime, context) => {
      const conversation = await runtime.conversation(runtime.conversationId, context);

      if (conversation === undefined) {
        throw new Error('The wake conversation is missing');
      }

      await runtime.commit(async (transaction) => {
        const state = await transaction.doc(State);
        const record = await Wakes.read(transaction, task.input.id);

        if (record === undefined) {
          throw new Error('The durable wake receipt is missing');
        }

        const wake: ActorWake = decodeStored(WakeRecordSchema, record.value);

        if (state.isQuiesced && wake.status === 'scheduled') {
          return {
            status: 'sleeping',
            until: runtime.now() + Duration.toMillis(WAKE_RETRY_DELAY),
            checkpoint: { phase: 'deliver' },
          };
        }

        if (wake.status === 'scheduled') {
          const notification: ActorNotification = {
            id: task.input.notificationId,
            text: task.input.text,
            source: { name: 'self-wake', eventId: task.input.id },
            producer: { kind: 'producer', id: 'mechane-self' },
            data: { wakeId: task.input.id },
          };

          await admitInTransaction({
            transaction,
            conversation,
            notification,
            digest: task.input.digest,
            isDeferred: state.isPolicyPaused,
          });

          const delivered: ActorWake = {
            ...wake,
            status: 'delivered',
            deliveredAt: new Date().toISOString(),
            notificationId: task.input.notificationId,
          };

          await Wakes.put(transaction, record.id, { ...record, value: JSON.stringify(delivered) });

          await appendEvent(transaction, {
            type: 'wake.delivered',
            runId: null,
            payload: { wakeId: wake.id, notificationId: task.input.notificationId },
          });
        }

        return { status: 'terminal', outcome: { status: 'completed', result: null } };
      }, context);
    },
  },
  abort: abortNotificationTask,
});

export async function scheduleWake(access: ActorAccess, input: ScheduleWakeInput): Promise<ActorWake> {
  if ((input.at === undefined) === (input.afterSeconds === undefined)) {
    throw new RequestInvalid({ reason: 'A wake requires one absolute or relative time' });
  }

  if (input.afterSeconds !== undefined && (!Number.isFinite(input.afterSeconds) || input.afterSeconds <= 0)) {
    throw new RequestInvalid({ reason: 'The wake delay must be positive' });
  }

  const digest = await fingerprint(input);

  const at: number = (() => {
    if (input.at !== undefined) {
      return Date.parse(input.at);
    }

    return Date.now() + Duration.toMillis(Duration.seconds(Number(input.afterSeconds)));
  })();

  if (!Number.isFinite(at) || Number.isNaN(new Date(at).getTime())) {
    throw new RequestInvalid({ reason: 'The wake time is invalid' });
  }

  const notificationId = crypto.randomUUID();

  const notification: ActorNotification = {
    id: notificationId,
    text: input.text,
    source: { name: 'self-wake', eventId: input.wakeId },
    producer: { kind: 'producer', id: 'mechane-self' },
    data: { wakeId: input.wakeId },
  };

  const notificationDigest = await fingerprint(notification);

  await access.arm();

  const receipt = await access.conversation.commit(async (transaction) => {
    const state = await transaction.doc(State);
    const existing = await Wakes.read(transaction, input.wakeId);

    if (existing !== undefined) {
      if (existing.digest !== digest) {
        throw new StoreConflict('The wake identity has different content');
      }

      return decodeStored(WakeRecordSchema, existing.value);
    }

    if (state.isQuiesced) {
      throw new Error('The mech is quiesced');
    }

    const taskId = await transaction.createTask(
      SelfWakeTask,
      { id: input.wakeId, text: input.text, at, notificationId, digest: notificationDigest },
      { ownership: { kind: 'conversation' }, background: true },
    );

    const wake: ActorWake = {
      id: input.wakeId,
      mechId: access.scope.mechId,
      text: input.text,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
      dueAt: new Date(at).toISOString(),
      canceledAt: null,
      deliveredAt: null,
      notificationId: null,
    };

    await Wakes.put(transaction, input.wakeId, { id: input.wakeId, taskId, digest, value: JSON.stringify(wake) });
    await appendEvent(transaction, {
      type: 'wake.scheduled',
      runId: null,
      payload: { wakeId: wake.id, dueAt: wake.dueAt },
    });

    return wake;
  }, BACKGROUND_CONTEXT);

  if (access.isDefinitionReady()) {
    access.harness.resume();
  }

  return receipt;
}

export async function readWake(access: ActorAccess, input: WakeIdentity): Promise<ActorWake | null> {
  const record = await Wakes.get(access.harness, input.wakeId, BACKGROUND_CONTEXT);

  if (record === undefined) {
    return null;
  }

  return decodeStored(WakeRecordSchema, record.value);
}

export async function listWakes(access: ActorAccess, input: ActorPageInput): Promise<ActorPage<ActorWake>> {
  const page = await Wakes.page(
    access.harness,
    { after: input.after ?? undefined, maxRows: Math.min(input.maxRows ?? WAKE_PAGE_DEFAULT_ROWS, WAKE_PAGE_MAX_ROWS) },
    BACKGROUND_CONTEXT,
  );

  return { items: page.items.map((record) => decodeStored(WakeRecordSchema, record.value)), hasMore: page.hasMore };
}

export async function cancelWake(access: ActorAccess, input: WakeIdentity): Promise<ActorWake> {
  await access.arm();

  const receipt = await access.harness.commit(async (transaction) => {
    const existing = await Wakes.read(transaction, input.wakeId);

    if (existing === undefined) {
      throw new RequestInvalid({ reason: 'The wake does not exist' });
    }

    const wake: ActorWake = decodeStored(WakeRecordSchema, existing.value);

    if (wake.status !== 'scheduled') {
      return wake;
    }

    const canceled: ActorWake = { ...wake, status: 'cancelled', canceledAt: new Date().toISOString() };

    await Wakes.put(transaction, existing.id, { ...existing, value: JSON.stringify(canceled) });

    await appendEvent(transaction, { type: 'wake.cancelled', runId: null, payload: { wakeId: wake.id } });

    return canceled;
  }, BACKGROUND_CONTEXT);

  const native = await Wakes.get(access.harness, input.wakeId, BACKGROUND_CONTEXT);

  if (!access.isDefinitionReady()) {
    return receipt;
  }

  if (receipt.status === 'cancelled' && native !== undefined) {
    await access.harness.abortTask(native.taskId, BACKGROUND_CONTEXT);
    access.harness.resume();
  }

  return receipt;
}
