import { withRuntimeStore } from '../store/runtime-store.ts';

type NotificationSelection = { readonly runId: string; readonly afterSequence: number };

type NotificationMessage = { readonly role: 'user'; readonly content: string };

type NotificationBatch = { readonly messages: ReadonlyArray<NotificationMessage>; readonly presentedSequence: number };

export async function readNotifications({ runId, afterSequence }: NotificationSelection): Promise<NotificationBatch> {
  'use step';

  return await withRuntimeStore(async (store) => {
    const batch = await store.drainNotifications({ runId, afterSequence });

    const messages: Array<NotificationMessage> = batch.notifications.map((notification) => ({
      role: 'user',
      content: JSON.stringify({
        notificationId: notification.id,
        receivedSequence: notification.receivedSequence,
        receivedAt: notification.receivedAt,
        source: notification.source,
        producer: notification.producer,
        text: notification.text,
        data: notification.data,
      }),
    }));

    return { messages, presentedSequence: batch.presentedSequence };
  });
}
