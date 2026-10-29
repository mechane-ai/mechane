import { Delivery, ListedEvent, MECH_DEFINITION_FIELDS, MECH_RECORD_FIELDS } from '@mechane/protocol';
import { renamedWireStruct, Sequence, TurnId } from '@mechane/records';
import { Schema } from 'effect';

/**
 * A page of the events after a cursor as the log stores them, each its `/v1` JSON, or no mech. Each reads as a listed
 * event, so a release rolled back to still lists a log that holds a type a later release added.
 */
export const EventsAnswer = Schema.TaggedUnion({
  Listed: { events: Schema.Array(Schema.fromJsonString(ListedEvent)), hasMore: Schema.Boolean },
  MechMissing: {},
});

export type EventsAnswer = typeof EventsAnswer.Type;

/** The point a mech was forked from as its object answers it: the parent, and the parent's last event at the fork. */
export const ForkPointRecord = Schema.Struct({ mechId: Schema.String, sequence: Sequence });

export type ForkPointRecord = typeof ForkPointRecord.Type;

/** The keys under which a mech's object sends its stored times, as epoch milliseconds. */
export const RECORD_TIME_KEYS = {
  createdAt: 'createdAtMs',
  receivedAt: 'receivedAtMs',
  startedAt: 'startedAtMs',
  endedAt: 'endedAtMs',
  canceledAt: 'canceledAtMs',
  savedAt: 'savedAtMs',
  openedAt: 'openedAtMs',
  updatedAt: 'updatedAtMs',
} as const;

/** A cancel the mech's object recorded on a turn or a drone, now or before. */
export const CancelRecord = Schema.TaggedStruct('Canceled', {
  canceledAt: Schema.DateTimeUtcFromMillis,
  cancelerId: Schema.String,
}).pipe(Schema.encodeKeys(RECORD_TIME_KEYS));

export type CancelRecord = typeof CancelRecord.Type;

/** An inbox item as the mech's object answers it, which decodes into the wire's inbox item. */
const InboxItemRecord = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
  delivery: Schema.Enum(Delivery),
  senderId: Schema.String,
  receivedAt: Schema.DateTimeUtcFromMillis,
  receivedSequence: Sequence,
}).pipe(Schema.encodeKeys(RECORD_TIME_KEYS));

/** A mech as its object answers it, which decodes into the wire's mech. */
export const MechRecord = Schema.Struct({
  ...MECH_RECORD_FIELDS,
  /** The mech and sequence it was forked from, none for a mech created new. */
  forkedFrom: Schema.OptionFromNullOr(ForkPointRecord),
}).pipe(Schema.encodeKeys(RECORD_TIME_KEYS));

export type MechRecord = typeof MechRecord.Type;

const MechRevisionRecord = renamedWireStruct({ fields: MECH_DEFINITION_FIELDS, renames: { updatedAt: 'updatedAtMs' } });

/** The current saved mech definition and lifecycle state, or a missing-mech decision. */
export const MechAnswer = Schema.TaggedUnion({ Found: { mech: MechRecord }, MechMissing: {} });

export type MechAnswer = typeof MechAnswer.Type;

/** The saved update or a refusal identifying a missing mech or the revision that made the request stale. */
export const MechUpdateAnswer = Schema.TaggedUnion({
  Updated: { mech: MechRecord },
  MechMissing: {},
  Conflicting: { currentRevision: Schema.Int },
});

export type MechUpdateAnswer = typeof MechUpdateAnswer.Type;

/** An ordered page of immutable definition history, or a missing-mech decision. */
export const MechRevisionsAnswer = Schema.TaggedUnion({
  Listed: { revisions: Schema.Array(MechRevisionRecord), hasMore: Schema.Boolean },
  MechMissing: {},
});

export type MechRevisionsAnswer = typeof MechRevisionsAnswer.Type;

/** A saved memory as the mech's object answers it, which decodes into the wire's memory. */
const MemoryRecord = Schema.Struct({
  path: Schema.String,
  text: Schema.String,
  digest: Schema.String,
  version: Schema.Int,
  turnId: TurnId,
  savedAt: Schema.DateTimeUtcFromMillis,
}).pipe(Schema.encodeKeys(RECORD_TIME_KEYS));

/** What a fork found: the new mech, once its copy ended and its workspace indexed it, no mech, or a busy one. */
export const ForkAnswer = Schema.TaggedUnion({ Forked: { mech: MechRecord }, MechMissing: {}, Busy: {} });

export type ForkAnswer = typeof ForkAnswer.Type;

/** What a send found: the item received now or before, no mech, or an item with the id and another text or delivery. */
export const InboxItemReceipt = Schema.TaggedUnion({
  Received: { inboxItem: InboxItemRecord },
  MechMissing: {},
  Conflicting: {},
  Archived: {},
});

export type InboxItemReceipt = typeof InboxItemReceipt.Type;

/** A mech's saved memories by path, or no mech. */
export const MemoriesAnswer = Schema.TaggedUnion({ Listed: { memories: Schema.Array(MemoryRecord) }, MechMissing: {} });

export type MemoriesAnswer = typeof MemoriesAnswer.Type;

/** What a cancel found: the turn's first cancel, now or before, no mech, no such turn, or a turn that ended. */
export const TurnCancelAnswer = Schema.Union([
  CancelRecord,
  Schema.TaggedStruct('MechMissing', {}),
  Schema.TaggedStruct('TurnMissing', {}),
  Schema.TaggedStruct('Ended', {}),
]).pipe(Schema.toTaggedUnion('_tag'));

export type TurnCancelAnswer = typeof TurnCancelAnswer.Type;
