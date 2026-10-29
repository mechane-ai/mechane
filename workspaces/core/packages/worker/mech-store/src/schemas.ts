import {
  Delivery,
  ForkPoint,
  MECH_RECORD_FIELDS,
  NOTED_REASONS,
  TurnStatus,
  UnansweredReason,
} from '@mechane/protocol';
import { DroneId, renamedWireStruct, Sequence, TurnId } from '@mechane/records';
import { Schema } from 'effect';

/** An inbox item as the mech received it, with how it reaches the mech and the sequence of its receipt's event. */
export const InboxItemRow = renamedWireStruct({
  fields: {
    id: Schema.String,
    text: Schema.String,
    delivery: Schema.Enum(Delivery),
    senderId: Schema.String,
    receivedAt: Schema.DateTimeUtcFromMillis,
    receivedSequence: Sequence,
  },
  renames: { receivedAt: 'received_at_ms' },
});

export type InboxItemRow = typeof InboxItemRow.Type;

/** An inbox item that waits for its turn to end, or a silent one not yet written, as a delivery submits it. */
export const PendingItemRow = renamedWireStruct({
  fields: {
    id: Schema.String,
    text: Schema.String,
    delivery: Schema.Enum(Delivery),
    receivedAt: Schema.DateTimeUtcFromMillis,
  },
  renames: { receivedAt: 'received_at_ms' },
});

export type PendingItemRow = typeof PendingItemRow.Type;

/** A turn, as `/v1` reads it, by its status: only an ended turn has its end, and only an unanswered one a reason. */
export const TurnRow = Schema.Union([
  renamedWireStruct({
    fields: {
      id: TurnId,
      status: Schema.Literal(TurnStatus.Running),
      startedAt: Schema.DateTimeUtcFromMillis,
      definitionRevision: Schema.Int,
    },
    renames: { startedAt: 'started_at_ms' },
  }),
  renamedWireStruct({
    fields: {
      id: TurnId,
      status: Schema.Literal(TurnStatus.Answered),
      definitionRevision: Schema.Int,
      startedAt: Schema.DateTimeUtcFromMillis,
      endedAt: Schema.DateTimeUtcFromMillis,
    },
    renames: { startedAt: 'started_at_ms', endedAt: 'ended_at_ms' },
  }),
  renamedWireStruct({
    fields: {
      id: TurnId,
      status: Schema.Literal(TurnStatus.Unanswered),
      definitionRevision: Schema.Int,
      startedAt: Schema.DateTimeUtcFromMillis,
      endedAt: Schema.DateTimeUtcFromMillis,
      reason: Schema.Enum(UnansweredReason),
    },
    renames: { startedAt: 'started_at_ms', endedAt: 'ended_at_ms' },
  }),
]);

export type TurnRow = typeof TurnRow.Type;

/** A turn whose note is unwritten: why it ends without a reply, and since when the note is owed. */
export const OwedNoteRow = renamedWireStruct({
  fields: { id: Schema.String, reason: Schema.Literals(NOTED_REASONS), owedAt: Schema.DateTimeUtcFromMillis },
  renames: { owedAt: 'owed_at_ms' },
});

export type OwedNoteRow = typeof OwedNoteRow.Type;

/** The copy a fork's object receives from its parent, from when it began. */
export const CopyRow = renamedWireStruct({
  fields: { startedAt: Schema.DateTimeUtcFromMillis },
  renames: { startedAt: 'started_at_ms' },
});

export type CopyRow = typeof CopyRow.Type;

/**
 * A fork a mech made, under the new mech's id and name. Its start is the new mech's creation, and its copy holds the
 * mech's events through its sequence.
 */
export const ForkRow = renamedWireStruct({
  fields: {
    id: Schema.String,
    name: Schema.String,
    requesterId: Schema.String,
    startedAt: Schema.DateTimeUtcFromMillis,
    /** Absent until the new mech's copy ended. */
    sequence: Schema.OptionFromNullOr(Sequence),
  },
  renames: { startedAt: 'started_at_ms' },
});

export type ForkRow = typeof ForkRow.Type;

/** The mech an object holds, stored as `/v1` serves it. */
export const MechRow = renamedWireStruct({
  fields: {
    ...MECH_RECORD_FIELDS,
    workspaceId: Schema.String,
    /** Absent for a mech that no fork made. */
    forkedFrom: Schema.OptionFromNullOr(Schema.fromJsonString(ForkPoint)),
  },
  renames: { createdAt: 'created_at_ms', updatedAt: 'updated_at_ms' },
});

export type MechRow = typeof MechRow.Type;

/** When the allowance refused one of a turn's or a drone's dispatches. */
export const RefusalRow = renamedWireStruct({
  fields: { refusedAt: Schema.DateTimeUtcFromMillis },
  renames: { refusedAt: 'refused_at_ms' },
});

export type RefusalRow = typeof RefusalRow.Type;

/** A cancel recorded on a turn or a drone: when, and by whom. */
export const CancelRow = renamedWireStruct({
  fields: { canceledAt: Schema.DateTimeUtcFromMillis, cancelerId: Schema.String },
  renames: { canceledAt: 'canceled_at_ms' },
});

export type CancelRow = typeof CancelRow.Type;

/** An id of a row a statement answers. */
export const IdRow = Schema.Struct({ id: Schema.String });

export type IdRow = typeof IdRow.Type;

/** The work a dispatch counts against, the running turn or a running drone, whose id the ledger stores. */
export const DispatchWork = Schema.TaggedUnion({ Turn: { id: TurnId }, Drone: { id: DroneId } });

export type DispatchWork = typeof DispatchWork.Type;
