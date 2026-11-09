import { Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import type { StoreContext } from '../../context.ts';
import { StoreConflict } from '../../errors.ts';

type ForkScope = {
  readonly context: StoreContext;
  readonly workspaceId: string;
  readonly sourceMechId: string;
  readonly targetMechId: string;
};

type ForkNotificationReferences = {
  readonly ids: ReadonlyMap<string, string>;
  readonly sequences: ReadonlyMap<number, number>;
};

type ForkStateInput = ForkScope & {
  readonly notifications: ForkNotificationReferences;
  readonly sessionIds: ReadonlyMap<string, string>;
  readonly runIds: ReadonlyMap<string, string>;
};

type MappedReference = { readonly id: string; readonly ids: ReadonlyMap<string, string> };
type MappedSequence = { readonly sequence: number; readonly sequences: ReadonlyMap<number, number> };

type ActivityReferences = {
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly notifications: ForkNotificationReferences;
  readonly messageIds: ReadonlyMap<string, string>;
};

const NotificationIdentity = Schema.Struct({ id: Schema.String, received_sequence: Schema.Number });

const ConsoleIdentity = Schema.Struct({
  id: Schema.String,
  run_id: Schema.NullOr(Schema.String),
  notification_id: Schema.NullOr(Schema.String),
});

const MailboxIdentity = Schema.Struct({
  session_id: Schema.NullOr(Schema.String),
  received_sequence: Schema.Number,
  presented_sequence: Schema.Number,
});

export function mappedForkId({ id, ids }: MappedReference): string {
  const mapped = ids.get(id);

  if (mapped === undefined) {
    throw new StoreConflict('The fork source contains an unmapped record reference');
  }

  return mapped;
}

export async function forkNotifications({
  context,
  workspaceId,
  sourceMechId,
  targetMechId,
}: ForkScope): Promise<ForkNotificationReferences> {
  const source = await context.client.query(
    'SELECT id,received_sequence FROM mechane.notifications WHERE mech_id=$1 ORDER BY received_sequence',
    [sourceMechId],
  );

  const notifications = Schema.decodeUnknownSync(Schema.Array(NotificationIdentity))(source.rows);
  const ids = new Map<string, string>();
  const sequences = new Map<number, number>();

  for (const notification of notifications) {
    const notificationId = randomUUID();

    const inserted = await context.client.query(
      `INSERT INTO mechane.notifications(id,workspace_id,mech_id,text,source,producer,producer_key,source_name,source_event_id,data,received_at)
       SELECT $1,$2,$3,text,source,producer,producer_key,source_name,source_event_id,data,received_at
       FROM mechane.notifications WHERE id=$4 RETURNING id,received_sequence`,
      [notificationId, workspaceId, targetMechId, notification.id],
    );

    const copied = Schema.decodeUnknownSync(NotificationIdentity)(inserted.rows[0]);

    ids.set(notification.id, copied.id);
    sequences.set(notification.received_sequence, copied.received_sequence);
  }

  return { ids, sequences };
}

export async function forkNotificationState(input: ForkStateInput): Promise<ReadonlyMap<string, string>> {
  await copyMailbox(input);

  return await copyConsoleMessages(input);
}

export function forkNotificationPayload({ type, payload, notifications, messageIds }: ActivityReferences) {
  const copied = { ...payload };

  if (type === 'console.message') {
    if (typeof copied['messageId'] === 'string') {
      copied['messageId'] = mappedForkId({ id: copied['messageId'], ids: messageIds });
    }

    return copied;
  }

  if (type === 'notification.received') {
    if (typeof copied['notificationId'] === 'string') {
      copied['notificationId'] = mappedForkId({ id: copied['notificationId'], ids: notifications.ids });
    }

    if (typeof copied['receivedSequence'] === 'number') {
      copied['receivedSequence'] = mappedForkSequence({
        sequence: copied['receivedSequence'],
        sequences: notifications.sequences,
      });
    }

    return copied;
  }

  if (Array.isArray(copied['notificationIds'])) {
    copied['notificationIds'] = copied['notificationIds'].map((id: unknown) => {
      if (typeof id !== 'string') {
        throw new StoreConflict('The fork source activity contains an invalid notification reference');
      }

      return mappedForkId({ id, ids: notifications.ids });
    });
  }

  return copied;
}

function mappedForkSequence({ sequence, sequences }: MappedSequence): number {
  if (sequence === 0) {
    return 0;
  }

  const mapped = sequences.get(sequence);

  if (mapped === undefined) {
    throw new StoreConflict('The fork source contains an unmapped notification cursor');
  }

  return mapped;
}

async function copyMailbox({
  context,
  workspaceId,
  sourceMechId,
  targetMechId,
  notifications,
  sessionIds,
}: ForkStateInput): Promise<void> {
  const source = await context.client.query(
    'SELECT session_id,received_sequence,presented_sequence FROM mechane.mech_mailboxes WHERE mech_id=$1',
    [sourceMechId],
  );

  if (source.rows.length === 0) {
    return;
  }

  const mailbox = Schema.decodeUnknownSync(MailboxIdentity)(source.rows[0]);

  const receivedSequence = mappedForkSequence({
    sequence: mailbox.received_sequence,
    sequences: notifications.sequences,
  });

  const presentedSequence = mappedForkSequence({
    sequence: mailbox.presented_sequence,
    sequences: notifications.sequences,
  });

  const sessionId = mappedMailboxSession({ id: mailbox.session_id, ids: sessionIds });

  await context.client.query(
    `INSERT INTO mechane.mech_mailboxes(
       mech_id,workspace_id,session_id,received_sequence,presented_sequence,active_run_id,is_wake_pending,
       is_environment_checkpoint_required,model_messages,notes_imported_at,is_context_initialized)
     SELECT $1,$2,$4,$5,$6,NULL,false,
       is_environment_checkpoint_required,model_messages,NULL,is_context_initialized
     FROM mechane.mech_mailboxes WHERE mech_id=$3`,
    [targetMechId, workspaceId, sourceMechId, sessionId, receivedSequence, presentedSequence],
  );
}

type NullableReference = { readonly id: string | null; readonly ids: ReadonlyMap<string, string> };

function mappedMailboxSession({ id, ids }: NullableReference): string | null {
  if (id === null) {
    return null;
  }

  return mappedForkId({ id, ids });
}

async function copyConsoleMessages({
  context,
  workspaceId,
  sourceMechId,
  targetMechId,
  notifications,
  runIds,
}: ForkStateInput): Promise<ReadonlyMap<string, string>> {
  const source = await context.client.query(
    'SELECT id,run_id,notification_id FROM mechane.console_messages WHERE mech_id=$1 ORDER BY sequence',
    [sourceMechId],
  );

  const messages = Schema.decodeUnknownSync(Schema.Array(ConsoleIdentity))(source.rows);
  const ids = new Map<string, string>();

  for (const message of messages) {
    if (message.notification_id === null) {
      if (message.run_id === null) {
        throw new StoreConflict('The fork source Console message has no activation');
      }

      const runId = mappedForkId({ id: message.run_id, ids: runIds });
      const messageId = randomUUID();

      await context.client.query(
        `INSERT INTO mechane.console_messages(id,workspace_id,mech_id,run_id,tool_call_id,role,text,presentation,created_at)
         SELECT $1,$2,$3,$4,tool_call_id,role,text,presentation,created_at FROM mechane.console_messages WHERE id=$5`,
        [messageId, workspaceId, targetMechId, runId, message.id],
      );
      ids.set(message.id, messageId);
    } else {
      const notificationId = mappedForkId({ id: message.notification_id, ids: notifications.ids });

      await context.client.query(
        `INSERT INTO mechane.console_messages(id,workspace_id,mech_id,notification_id,role,text,presentation,created_at)
         SELECT $1,$2,$3,$1,role,text,presentation,created_at FROM mechane.console_messages WHERE id=$4`,
        [notificationId, workspaceId, targetMechId, message.id],
      );
      ids.set(message.id, notificationId);
    }
  }

  return ids;
}
