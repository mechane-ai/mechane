import { isWellFormedText, RecordId, RecordText } from '@mechane/records';
import { Schema } from 'effect';

/** A notice may include a complete provider message within the bounded admission request. */
export const NOTIFICATION_TEXT_MAX_CHARS = 65_536;

/** Producers retain this UUID across retries; deterministic UUIDs identify the same external event. */
export const NotificationId = RecordId.pipe(Schema.brand('NotificationId'));
export type NotificationId = typeof NotificationId.Type;

/** New notices accept whole Unicode text within the admission limit. */
export const NotificationText = Schema.String.check(
  isWellFormedText,
  Schema.isBetweenLength(1, NOTIFICATION_TEXT_MAX_CHARS),
);

export type NotificationText = typeof NotificationText.Type;

/** Retained source metadata remains readable if a later producer admission limit changes. */
export const RecordedNotificationSource = Schema.Struct({
  name: RecordText,
  eventId: RecordText,
  /** Absent when no source link was recorded. */
  url: Schema.optionalKey(RecordText),
});

export type RecordedNotificationSource = typeof RecordedNotificationSource.Type;
