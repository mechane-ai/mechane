import { isWellFormedText, MechId, RecordId, RecordText, renamedWireStruct, Sequence } from '@mechane/records';
import { Schema } from 'effect';
import { UnknownFields, WireTime } from '../../schemas.ts';

/** A notice may include a complete provider message within the bounded admission request. */
export const NOTIFICATION_TEXT_MAX_CHARS = 65_536;

const SOURCE_NAME_MAX_CHARS = 128;
const SOURCE_EVENT_ID_MAX_CHARS = 512;
const SOURCE_URL_MAX_CHARS = 4096;
const SOURCE_URL_PROTOCOLS: ReadonlySet<string> = new Set(['https:', 'http:']);

/** Producers retain this UUID across retries; deterministic UUIDs identify the same external event. */
export const NotificationId = RecordId.pipe(Schema.brand('NotificationId'));
export type NotificationId = typeof NotificationId.Type;

/** New notices accept whole Unicode text within the admission limit. */
export const NotificationText = Schema.String.check(
  isWellFormedText,
  Schema.isBetweenLength(1, NOTIFICATION_TEXT_MAX_CHARS),
);

export type NotificationText = typeof NotificationText.Type;

const SourceName = Schema.NonEmptyString.check(isWellFormedText, Schema.isMaxLength(SOURCE_NAME_MAX_CHARS));
const SourceEventId = Schema.NonEmptyString.check(isWellFormedText, Schema.isMaxLength(SOURCE_EVENT_ID_MAX_CHARS));

const SourceUrl = Schema.String.check(
  Schema.isMaxLength(SOURCE_URL_MAX_CHARS),
  Schema.makeFilter(
    (value) => {
      if (!URL.canParse(value)) {
        return false;
      }

      const url = new URL(value);

      if (!SOURCE_URL_PROTOCOLS.has(url.protocol)) {
        return false;
      }

      return url.username === '' && url.password === '';
    },
    { expected: 'an HTTP source URL without credentials' },
  ),
);

/** Source fields describe the notice; only server authentication identifies its producer. */
const NotificationSource = Schema.Struct({
  name: SourceName,
  eventId: SourceEventId,
  /** Absent when the producer has no human-readable source link. */
  url: Schema.optionalKey(SourceUrl),
});

/** Retained source metadata remains readable if a later producer admission limit changes. */
export const RecordedNotificationSource = Schema.Struct({
  name: RecordText,
  eventId: RecordText,
  /** Absent when no source link was recorded. */
  url: Schema.optionalKey(RecordText),
});

export type RecordedNotificationSource = typeof RecordedNotificationSource.Type;

/** Producers use the same camelCase body as member clients. */
export const NotificationBody = Schema.Struct({
  text: NotificationText,
  source: NotificationSource,
  /** Absent when the producer has no additional event metadata. */
  // oxlint-disable-next-line id-denylist -- Generic producers use this documented JSON field.
  data: Schema.optionalKey(UnknownFields),
});

export type NotificationBody = typeof NotificationBody.Type;

/** Acceptance records a durable notice, not a promise that the mech will reply. */
export const NotificationReceipt = renamedWireStruct({
  fields: {
    id: NotificationId,
    mechId: MechId,
    receivedAt: WireTime,
    receivedSequence: Sequence,
    wasCreated: Schema.Boolean,
  },
  renames: { wasCreated: 'was_created' },
});

export type NotificationReceipt = typeof NotificationReceipt.Type;
