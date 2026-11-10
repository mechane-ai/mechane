import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { copyJson } from '@earendil-works/chord/json';
import type { ConversationHandle, SubmissionId, Tx } from '@earendil-works/pi-durable';
import { LiveDoc } from '@earendil-works/pi-durable';
import { MechArchived, NotificationConflict, RequestInvalid } from '@mechane/protocol';
import { MechId, RecordId } from '@mechane/records';
import { Option, Schema } from 'effect';
import type { ActorNotification } from '../actor/client.ts';
import {
  Events,
  ImportedNotifications,
  Messages,
  Notifications,
  PendingNotifications,
  putTurn,
  runEvents,
  SequenceNotifications,
  SubmissionNotifications,
  Turns,
} from '../actor/collections.ts';
import type { NotificationRecord, TurnRecord } from '../actor/record-schemas.ts';
import {
  decodeStored,
  NotificationRecord as NotificationRecordSchema,
  RunRecord,
  StoredFields,
} from '../actor/records.ts';
import { fingerprint, State } from '../actor/state.ts';
import type { ActorState } from '../actor/state.ts';
import type { ActorAccess } from '../actor/types.ts';
import type { ActivityEvent, ConsoleMessage, Notification, NotificationReceipt, Run } from '../domain.ts';

type AppendEventInput = {
  readonly id?: string;
  readonly type: string;
  readonly runId: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
};

type PendingNotification = {
  readonly retained: Notification;
  readonly notification: ActorNotification;
  readonly digest: string | undefined;
};

type NotificationAdmissionInput = {
  readonly transaction: Tx;
  readonly conversation: Pick<ConversationHandle, 'submit' | 'id'>;
  readonly notification: ActorNotification;
  readonly digest: string;
  readonly receivedAt?: string;
  readonly receivedSequence?: number;
  readonly isDeferred?: boolean;
  readonly isRelease?: boolean;
};

type NotificationCommitInput = {
  readonly access: ActorAccess;
  readonly notification: ActorNotification;
  readonly run: (transaction: Tx) => Promise<NotificationReceipt>;
};

async function commitNotification({
  access,
  notification,
  run,
}: NotificationCommitInput): Promise<NotificationReceipt> {
  if (notification.producer.kind !== 'member') {
    return await access.harness.commit(run, BACKGROUND_CONTEXT);
  }

  const principalId = notification.producer.principalId;

  return await access.withControl(
    async (store) =>
      await store.withMemberAdmission({
        ...access.scope,
        principalId,
        run: async (authorize) =>
          await access.harness.commit(async (transaction) => {
            await authorize();

            return await run(transaction);
          }, BACKGROUND_CONTEXT),
      }),
  );
}

export async function notificationFingerprint(notification: ActorNotification): Promise<string> {
  const { shouldPublishToConsole: _publication, ...payload } = notification;

  return await fingerprint(payload);
}

export async function appendEvent(transaction: Tx, input: AppendEventInput): Promise<void> {
  const state = await transaction.doc(State);

  if (state.scope === null) {
    throw new Error('The actor scope is missing');
  }

  const id = input.id ?? crypto.randomUUID();

  if ((await Events.read(transaction, id)) !== undefined) {
    return;
  }

  const event: ActivityEvent = {
    ...state.scope,
    ...input,
    id,
    sequence: state.eventBaseSequence + (await Events.totalInTransaction(transaction)) + 1,
    createdAt: new Date().toISOString(),
  };

  await Events.put(transaction, event.id, event);

  if (event.runId !== null) {
    await runEvents(event.runId).put(transaction, event.id, event.id);
  }
}

function turnFromNotification(state: ActorState, record: NotificationRecord): Run {
  if (state.scope === null) {
    throw new Error('The actor scope is missing');
  }

  const notification = decodeStored(NotificationRecordSchema, record.value);

  return {
    ...state.scope,
    runtimeSource: 'native',
    id: record.turnId,
    sessionId: state.scope.mechId,
    inputId: notification.id,
    notificationIds: [notification.id],
    definitionRevision: state.activeRevision,
    status: 'queued',
    version: 1,
    inputText: notification.text,
    attachments: [],
    origin: { kind: 'notification', notificationId: notification.id },
    createdAt: record.receivedAt,
    startedAt: null,
    endedAt: null,
    error: null,
    failureReason: null,
    reply: null,
    cancelRequestedAt: null,
  };
}

export async function notificationsForInputs(transaction: Tx, inputs: ReadonlyArray<SubmissionId>) {
  const records: Array<NotificationRecord> = [];

  for (const submissionId of inputs) {
    const id = await SubmissionNotifications.read(transaction, String(submissionId));

    if (id !== undefined) {
      const notification = await Notifications.read(transaction, id);

      if (notification === undefined) {
        throw new Error('The submission notification record is missing');
      }

      records.push(notification);
    }
  }

  return records;
}

export async function turnForNativeInputs(transaction: Tx, inputs: ReadonlyArray<SubmissionId>): Promise<TurnRecord> {
  const notifications = await notificationsForInputs(transaction, inputs);

  for (const notification of notifications) {
    const turn = await Turns.read(transaction, notification.turnId);

    if (turn !== undefined && decodeStored(RunRecord, turn.value).endedAt === null) {
      return turn;
    }
  }

  for (const notification of notifications) {
    const existing = await Turns.read(transaction, notification.turnId);

    if (existing === undefined) {
      const state = await transaction.doc(State);

      const turn: TurnRecord = {
        id: notification.turnId,
        sequence: (await Turns.totalInTransaction(transaction)) + 1,
        submissionId: notification.submissionId,
        taskIds: [],
        value: JSON.stringify(turnFromNotification(state, notification)),
      };

      await putTurn(transaction, turn);

      return turn;
    }
  }

  throw new Error('The native run has no admitted notification');
}

export function pendingNotification(value: string): PendingNotification {
  const retained = decodeStored(NotificationRecordSchema, value);
  const fields = decodeStored(StoredFields, value);

  const notification: ActorNotification = {
    id: retained.id,
    text: retained.text,
    source: retained.source,
    producer: retained.producer,
    data: retained.data,
  };

  const digest = Option.getOrUndefined(Option.liftPredicate(Schema.is(Schema.String))(fields['admissionDigest']));

  if (fields['shouldPublishToConsole'] === true) {
    return { retained, notification: { ...notification, shouldPublishToConsole: true }, digest };
  }

  return { retained, notification, digest };
}

export async function admitInTransaction(input: NotificationAdmissionInput): Promise<NotificationReceipt> {
  const state = await input.transaction.doc(State);

  if (state.scope === null) {
    throw new RequestInvalid({ reason: 'The mech scope is missing' });
  }

  const previous = await Notifications.read(input.transaction, input.notification.id);

  if (previous !== undefined) {
    if (previous.digest !== input.digest) {
      throw new NotificationConflict({ notificationId: RecordId.make(input.notification.id) });
    }

    return {
      id: previous.id,
      mechId: state.scope.mechId,
      receivedAt: previous.receivedAt,
      receivedSequence: previous.sequence,
      wasCreated: false,
    };
  }

  const pendingValue = await PendingNotifications.read(input.transaction, input.notification.id);

  if (pendingValue !== undefined) {
    const pending = pendingNotification(pendingValue);

    if ((pending.digest ?? (await notificationFingerprint(pending.notification))) !== input.digest) {
      throw new NotificationConflict({ notificationId: RecordId.make(input.notification.id) });
    }

    if (input.isRelease !== true) {
      return {
        id: pending.retained.id,
        mechId: state.scope.mechId,
        receivedAt: pending.retained.receivedAt,
        receivedSequence: pending.retained.receivedSequence,
        wasCreated: false,
      };
    }

    await PendingNotifications.remove(input.transaction, input.notification.id);
  }

  if (state.isQuiesced) {
    throw new RequestInvalid({ reason: 'The mech is quiesced' });
  }

  const acceptedAt = input.receivedAt ?? new Date().toISOString();
  const sequence = input.receivedSequence ?? state.notificationBaseSequence + 1;
  state.notificationBaseSequence = Math.max(state.notificationBaseSequence, sequence);

  const notification: Notification = {
    ...state.scope,
    ...input.notification,
    receivedAt: acceptedAt,
    receivedSequence: sequence,
  };

  const placed: { turnId: string | null } = { turnId: null };

  if (input.isDeferred === true) {
    await PendingNotifications.put(
      input.transaction,
      notification.id,
      JSON.stringify({ ...notification, admissionDigest: input.digest }),
    );
  } else {
    const live = await input.transaction.doc(LiveDoc, input.conversation.id);
    const wasBusy = live.run !== undefined;

    const submissionId = await input.conversation.submit(input.transaction, {
      type: 'input',
      requestId: input.notification.id,
      whenBusy: 'steer',
      content: JSON.stringify({ notification }),
      entry: { kind: 'mechane.notification', data: copyJson(notification, { omitUndefinedProperties: true }) },
    });

    const turnId = crypto.randomUUID();

    const record: NotificationRecord = {
      id: notification.id,
      digest: input.digest,
      sequence,
      receivedAt: acceptedAt,
      submissionId,
      turnId,
      value: JSON.stringify(notification),
    };

    await Notifications.put(input.transaction, record.id, record);
    await SubmissionNotifications.put(input.transaction, String(submissionId), record.id);
    await SequenceNotifications.put(input.transaction, String(sequence), record.id);

    if (!wasBusy) {
      await putTurn(input.transaction, {
        id: turnId,
        sequence: (await Turns.totalInTransaction(input.transaction)) + 1,
        submissionId,
        taskIds: [],
        value: JSON.stringify(turnFromNotification(state, record)),
      });

      placed.turnId = turnId;
    }
  }

  if (input.isRelease !== true) {
    await appendEvent(input.transaction, {
      type: 'notification.received',
      runId: placed.turnId,
      payload: {
        notificationId: notification.id,
        receivedSequence: sequence,
        text: notification.text,
        source: notification.source,
      },
    });
  }

  if (input.isRelease !== true && input.notification.shouldPublishToConsole === true) {
    const message: ConsoleMessage = {
      ...state.scope,
      id: notification.id,
      runId: placed.turnId,
      sequence: state.messageBaseSequence + (await Messages.totalInTransaction(input.transaction)) + 1,
      role: 'user',
      text: notification.text,
      presentation: null,
      createdAt: acceptedAt,
    };

    await Messages.put(input.transaction, message.id, message);
  }

  return {
    id: notification.id,
    mechId: state.scope.mechId,
    receivedAt: acceptedAt,
    receivedSequence: sequence,
    wasCreated: true,
  };
}

export async function admitNotification(
  access: ActorAccess,
  notification: ActorNotification,
): Promise<NotificationReceipt> {
  const digest = await notificationFingerprint(notification);
  const previous = await Notifications.get(access.harness, notification.id);
  const pending = await PendingNotifications.get(access.harness, notification.id);

  if (previous !== undefined || pending !== undefined) {
    return await commitNotification({
      access,
      notification,
      run: async (transaction) =>
        await admitInTransaction({ transaction, conversation: access.conversation, notification, digest }),
    });
  }

  const archived = await ImportedNotifications.get(access.harness, notification.id);

  if (archived !== undefined) {
    const {
      workspaceId: _workspaceId,
      mechId: _mechId,
      receivedSequence: _sequence,
      receivedAt: _receivedAt,
      ...payload
    } = archived;

    if ((await notificationFingerprint(payload)) !== digest) {
      throw new NotificationConflict({ notificationId: RecordId.make(notification.id) });
    }

    return await commitNotification({
      access,
      notification,
      run: async () => ({
        id: archived.id,
        mechId: archived.mechId,
        receivedAt: archived.receivedAt,
        receivedSequence: archived.receivedSequence,
        wasCreated: false,
      }),
    });
  }

  const isDeferred = await access.withControl(async (store) => {
    const mech = await store.getMech(access.scope);
    const policy = await store.getRuntimePolicy(access.scope);

    if (mech.status === 'archived') {
      throw new MechArchived({ mechId: MechId.make(access.scope.mechId) });
    }

    const isPolicyPaused = mech.status !== 'active' || policy === null || policy.isSuspended;

    return isPolicyPaused || !access.isDefinitionReady();
  });

  await access.arm();

  return await commitNotification({
    access,
    notification,
    run: async (transaction) =>
      await admitInTransaction({ transaction, conversation: access.conversation, notification, digest, isDeferred }),
  });
}
