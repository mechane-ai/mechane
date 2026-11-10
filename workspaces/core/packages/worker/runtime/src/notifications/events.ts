import { ImportedNotifications, Notifications, PendingNotifications } from '../actor/collections.ts';
import type { ActorRecordReader } from '../actor/record-store.ts';
import { decodeStored, NotificationRecord } from '../actor/records.ts';
import type { ActivityEvent, Notification } from '../domain.ts';

async function receivedNotification(reader: ActorRecordReader, id: string): Promise<Notification | undefined> {
  const current = await Notifications.get(reader, id);

  if (current !== undefined) {
    return decodeStored(NotificationRecord, current.value);
  }

  const pending = await PendingNotifications.get(reader, id);

  if (pending !== undefined) {
    return decodeStored(NotificationRecord, pending);
  }

  return await ImportedNotifications.get(reader, id);
}

export async function nativeEvent(reader: ActorRecordReader, event: ActivityEvent): Promise<ActivityEvent> {
  if (event.type !== 'notification.received' || typeof event.payload['notificationId'] !== 'string') {
    return event;
  }

  const notification = await receivedNotification(reader, event.payload['notificationId']);

  if (notification === undefined) {
    return event;
  }

  return { ...event, payload: { ...event.payload, text: notification.text, source: notification.source } };
}
