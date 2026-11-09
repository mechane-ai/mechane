import {
  memberOrUnknown,
  PAGE_RENAMES,
  RecordId,
  RecordText,
  renamedWireStruct,
  Sequence,
  SlackChannelId,
  SlackTeamId,
  SlackUserId,
  TurnId,
  unknownMember,
  wireStruct,
} from '@mechane/records';
import { Schema } from 'effect';
import { UnknownFields, WireTime } from '../../schemas.ts';
import { ConsoleMessageId } from '../conversation/schemas.ts';
import { ForkPoint } from '../mechs/schemas.ts';
import { NotificationId, RecordedNotificationSource } from '../notifications/schemas.ts';
import { UnansweredReason } from '../turns/constants.ts';
import { EventType } from './constants.ts';

/** The fields of every event: its place in the log, dense from 1 and assigned at its commit, and when it committed. */
const EVENT_FIELDS = { sequence: Sequence.check(Schema.isGreaterThanOrEqualTo(1)), occurredAt: WireTime } as const;

/** One event of a mech's log, as `/api/v1` serves it and the mech stores it. */
export const Event = Schema.Union([
  wireStruct({
    fields: {
      ...EVENT_FIELDS,
      type: Schema.Literal(EventType.NotificationReceived),
      notificationId: NotificationId,
      receivedSequence: Sequence,
      text: RecordText,
      source: RecordedNotificationSource,
    },
  }),
  wireStruct({
    fields: {
      ...EVENT_FIELDS,
      type: Schema.Literals([EventType.ActivationStarted, EventType.ActivationCompleted, EventType.ActivationStopped]),
      turnId: TurnId,
      notificationIds: Schema.Array(NotificationId),
    },
  }),
  wireStruct({
    fields: {
      ...EVENT_FIELDS,
      type: Schema.Literal(EventType.ActivationFailed),
      turnId: TurnId,
      notificationIds: Schema.Array(NotificationId),
      reason: RecordText,
    },
  }),
  wireStruct({
    fields: {
      ...EVENT_FIELDS,
      type: Schema.Literal(EventType.ConsoleMessage),
      messageId: ConsoleMessageId,
      turnId: TurnId,
    },
  }),
  wireStruct({
    fields: {
      ...EVENT_FIELDS,
      type: Schema.Literal(EventType.InboxItemReceived),
      inboxItemId: RecordId,
      /** None means the sender has a channel identity rather than a Mechane principal; inspect the recorded source. */
      senderId: Schema.OptionFromNullOr(RecordId),
      text: RecordText,
      delivery: RecordText,
      /** Absent when this message has no recorded Slack origin. */
      source: Schema.optionalKey(
        wireStruct({
          fields: {
            channelId: SlackChannelId,
            teamId: SlackTeamId,
            messageTimestamp: Schema.NonEmptyString,
            userId: SlackUserId,
          },
        }),
      ),
    },
  }),
  wireStruct({
    fields: {
      ...EVENT_FIELDS,
      type: Schema.Literal(EventType.TurnStarted),
      turnId: TurnId,
      inboxItemIds: Schema.Array(RecordId),
    },
  }),
  wireStruct({
    fields: { ...EVENT_FIELDS, type: Schema.Literal(EventType.TurnCanceled), turnId: TurnId, cancelerId: RecordId },
  }),
  wireStruct({
    fields: { ...EVENT_FIELDS, type: Schema.Literal(EventType.TurnAnswered), turnId: TurnId, reply: RecordText },
  }),
  wireStruct({
    fields: {
      ...EVENT_FIELDS,
      type: Schema.Literal(EventType.TurnUnanswered),
      turnId: TurnId,
      reason: memberOrUnknown({ set: UnansweredReason }),
    },
  }),
  // The mech began as a fork of another, whose events up to the fork point come before this one in its log.
  wireStruct({ fields: { ...EVENT_FIELDS, type: Schema.Literal(EventType.MechForked), forkedFrom: ForkPoint } }),
]);

export type Event = typeof Event.Type;

/**
 * An event of a type a newer deployment added, which this release does not know. It holds its place, its time, its type
 * and its other fields as the wire wrote them.
 */
export const UnknownEvent = Schema.StructWithRest(
  Schema.Struct({ sequence: EVENT_FIELDS.sequence, occurred_at: WireTime, type: unknownMember({ set: EventType }) }),
  [UnknownFields],
);

export type UnknownEvent = typeof UnknownEvent.Type;

/** An event as a page lists it: one of a type this release knows, or one of a newer deployment's. */
export const ListedEvent = Schema.Union([Event, UnknownEvent]);

export type ListedEvent = typeof ListedEvent.Type;

/** The events after a cursor, oldest first, and whether more follow; an empty page means none came in the wait. */
export const EventPage = renamedWireStruct({
  fields: { events: Schema.Array(ListedEvent), hasMore: Schema.Boolean },
  renames: PAGE_RENAMES,
});

export type EventPage = typeof EventPage.Type;

/** A cursor into the log as a query writes it: the sequence of the last event a reader has, 0 before the first. */
export const EventCursor = Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));

export type EventCursor = typeof EventCursor.Type;
