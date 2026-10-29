import {
  DroneId,
  memberOrUnknown,
  PAGE_RENAMES,
  RecordId,
  RecordText,
  renamedWireStruct,
  Sequence,
  ThreadId,
  TurnId,
  unknownMember,
  wireStruct,
} from '@mechane/records';
import { Schema } from 'effect';
import { UnknownFields, WireTime } from '../../schemas.ts';
import { Delivery } from '../inbox/constants.ts';
import { ForkPoint } from '../mechs/schemas.ts';
import { UnansweredReason } from '../turns/constants.ts';
import { EventType } from './constants.ts';

/** The fields of every event: its place in the log, dense from 1 and assigned at its commit, and when it committed. */
const EVENT_FIELDS = { sequence: Sequence.check(Schema.isGreaterThanOrEqualTo(1)), occurredAt: WireTime } as const;

/** One event of a mech's log, as `/v1` serves it and the mech stores it. */
export const Event = Schema.Union([
  wireStruct({
    fields: {
      ...EVENT_FIELDS,
      type: Schema.Literal(EventType.InboxItemReceived),
      inboxItemId: RecordId,
      senderId: RecordId,
      text: RecordText,
      delivery: memberOrUnknown({ set: Delivery }),
    },
  }),
  // A silent item entered the mech's conversation without waking it.
  wireStruct({ fields: { ...EVENT_FIELDS, type: Schema.Literal(EventType.InboxItemWritten), inboxItemId: RecordId } }),
  wireStruct({
    fields: {
      ...EVENT_FIELDS,
      type: Schema.Literal(EventType.TurnStarted),
      turnId: TurnId,
      inboxItemIds: Schema.Array(RecordId),
    },
  }),
  // An item sent for the next pause joined the running turn at a pause between its model requests.
  wireStruct({
    fields: { ...EVENT_FIELDS, type: Schema.Literal(EventType.TurnJoined), turnId: TurnId, inboxItemId: RecordId },
  }),
  // A member canceled the running turn, by a cancel or an interrupt item; it ends unanswered once its work stops.
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
  // The mech started a drone on one of its threads, in its own sandbox and conversation.
  wireStruct({
    fields: { ...EVENT_FIELDS, type: Schema.Literal(EventType.DroneStarted), droneId: DroneId, threadId: ThreadId },
  }),
  // A drone ended with a report, which reached its mech as the inbox item named here.
  wireStruct({
    fields: {
      ...EVENT_FIELDS,
      type: Schema.Literal(EventType.DroneReported),
      droneId: DroneId,
      inboxItemId: RecordId,
      report: RecordText,
    },
  }),
  // A drone ended without a report, for a reason a turn would give; its mech received that as the item named here.
  wireStruct({
    fields: {
      ...EVENT_FIELDS,
      type: Schema.Literal(EventType.DroneUnreported),
      droneId: DroneId,
      inboxItemId: RecordId,
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
