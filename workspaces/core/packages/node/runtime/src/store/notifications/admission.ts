import { Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Notification, NotificationProducer, NotificationReceipt, NotificationSource } from '../../domain.ts';
import type { StoreContext } from '../context.ts';
import { AdmissionRefused, StoreConflict } from '../errors.ts';
import { createActivityStore } from '../execution/activity.ts';
import { MAXIMUM_NOTIFICATION_BYTES } from './context.ts';
import { lockMech } from './locking.ts';
import { decodeNotification, NotificationProducerSchema, NotificationSourceSchema } from './rows.ts';

type AdmitNotification = {
  readonly id: string;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly text: string;
  readonly source: NotificationSource;
  readonly producer: NotificationProducer;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly shouldPublishToConsole?: boolean;
};

const NOTIFICATION_ENVELOPE_OVERHEAD_BYTES = 1024;

function notificationProducerKey(producer: NotificationProducer): string {
  if (producer.kind === 'member') {
    return `member:${producer.principalId}`;
  }

  return `producer:${producer.id}`;
}

function receipt(notification: Notification, wasCreated: boolean): NotificationReceipt {
  return {
    id: notification.id,
    mechId: notification.mechId,
    receivedAt: notification.receivedAt,
    receivedSequence: notification.receivedSequence,
    wasCreated,
  };
}

async function requireProducer(context: StoreContext, input: AdmitNotification): Promise<void> {
  if (input.producer.kind === 'member') {
    const membership = await context.client.query(
      'SELECT principal_id FROM mechane.memberships WHERE workspace_id=$1 AND principal_id=$2 FOR SHARE',
      [input.workspaceId, input.producer.principalId],
    );

    if (membership.rows.length === 0) {
      throw new AdmissionRefused('Notification sender is not a workspace member');
    }
  } else if (input.shouldPublishToConsole === true) {
    throw new AdmissionRefused('A producer notification cannot impersonate a Console member');
  }
}

function assertSameNotification(prior: Notification, input: AdmitNotification): void {
  const sameScope = prior.workspaceId === input.workspaceId && prior.mechId === input.mechId;
  const sameContent = prior.text === input.text && isDeepStrictEqual(prior.data, input.data ?? null);
  const sameProducer = isDeepStrictEqual(prior.producer, input.producer);
  const sameSource = isDeepStrictEqual(prior.source, input.source);

  const hasSameIdentity = sameScope && sameProducer;
  const hasSamePayload = sameContent && sameSource;

  if (!hasSameIdentity || !hasSamePayload) {
    throw new StoreConflict('Notification identity was reused with different content');
  }
}

export function createNotificationAdmissionStore(context: StoreContext) {
  return {
    admitNotification: async (input: AdmitNotification): Promise<NotificationReceipt> => {
      Schema.decodeUnknownSync(NotificationProducerSchema)(input.producer);
      Schema.decodeUnknownSync(NotificationSourceSchema)(input.source);

      if (input.text.trim().length === 0 || input.source.name.length === 0 || input.source.eventId.length === 0) {
        throw new StoreConflict('Notification content is invalid');
      }

      if (
        Buffer.byteLength(JSON.stringify(input)) >
        MAXIMUM_NOTIFICATION_BYTES - NOTIFICATION_ENVELOPE_OVERHEAD_BYTES
      ) {
        throw new StoreConflict('Notification exceeds its storage limit');
      }

      return await context.atomic(async (transaction) => {
        const state = await lockMech(transaction, input);

        await requireProducer(transaction, input);

        const producerKey = notificationProducerKey(input.producer);

        const existing = await transaction.client.query(
          `SELECT * FROM mechane.notifications WHERE id=$1 OR
           (mech_id=$2 AND producer_key=$3 AND source_name=$4 AND source_event_id=$5)`,
          [input.id, input.mechId, producerKey, input.source.name, input.source.eventId],
        );

        if (existing.rows.length > 0) {
          if (existing.rows.length !== 1) {
            throw new StoreConflict('Notification identities refer to different events');
          }

          const prior = decodeNotification(existing.rows[0]);

          assertSameNotification(prior, input);

          return receipt(prior, false);
        }

        if (state.status === 'archived' || state.is_suspended) {
          throw new AdmissionRefused('This mech cannot receive notifications');
        }

        const saved = await transaction.client.query(
          `INSERT INTO mechane.notifications(id,workspace_id,mech_id,text,source,producer,producer_key,source_name,source_event_id,data)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING *`,
          [
            input.id,
            input.workspaceId,
            input.mechId,
            input.text,
            input.source,
            input.producer,
            producerKey,
            input.source.name,
            input.source.eventId,
            input.data ?? null,
          ],
        );

        if (saved.rows.length === 0) {
          const collision = await transaction.client.query('SELECT * FROM mechane.notifications WHERE id=$1', [
            input.id,
          ]);

          if (collision.rows.length === 0) {
            throw new StoreConflict('Notification identity collided with an existing event');
          }

          const prior = decodeNotification(collision.rows[0]);

          assertSameNotification(prior, input);

          return receipt(prior, false);
        }

        const notification = decodeNotification(saved.rows[0]);

        await transaction.client.query(
          `UPDATE mechane.mech_mailboxes SET received_sequence=$2,is_wake_pending=true,updated_at=now() WHERE mech_id=$1`,
          [input.mechId, notification.receivedSequence],
        );

        if (input.shouldPublishToConsole === true) {
          await transaction.client.query(
            `INSERT INTO mechane.console_messages(id,workspace_id,mech_id,notification_id,role,text)
             VALUES($1,$2,$3,$1,'user',$4)`,
            [input.id, input.workspaceId, input.mechId, input.text],
          );
        }

        await createActivityStore(transaction).appendActivity({
          id: randomUUID(),
          workspaceId: input.workspaceId,
          mechId: input.mechId,
          runId: null,
          type: 'notification.received',
          payload: {
            notificationId: notification.id,
            receivedSequence: notification.receivedSequence,
            text: input.text,
            source: input.source,
          },
        });

        return receipt(notification, true);
      });
    },
  };
}
