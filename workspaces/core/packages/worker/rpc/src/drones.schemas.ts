import { DroneStatus, ThreadState, UnansweredReason } from '@mechane/protocol';
import { DroneId, ThreadId } from '@mechane/records';
import { Schema } from 'effect';
import { CancelRecord, RECORD_TIME_KEYS } from './mech.schemas.ts';

/** The fields of a drone in each of its states, as the mech's object answers it. */
const DRONE_RECORD_FIELDS = { id: DroneId, threadId: ThreadId, startedAt: Schema.DateTimeUtcFromMillis } as const;

/** What a drone cancel found: the drone's first cancel, now or before, no mech, no such drone, or an ended drone. */
export const DroneCancelAnswer = Schema.Union([
  CancelRecord,
  Schema.TaggedStruct('MechMissing', {}),
  Schema.TaggedStruct('DroneMissing', {}),
  Schema.TaggedStruct('Ended', {}),
]).pipe(Schema.toTaggedUnion('_tag'));

export type DroneCancelAnswer = typeof DroneCancelAnswer.Type;

/** A thread as the mech's object answers it, which decodes into the wire's thread. */
const ThreadRecord = Schema.Struct({
  id: ThreadId,
  title: Schema.String,
  state: Schema.Enum(ThreadState),
  note: Schema.OptionFromNullOr(Schema.String),
  openedAt: Schema.DateTimeUtcFromMillis,
  updatedAt: Schema.DateTimeUtcFromMillis,
}).pipe(Schema.encodeKeys(RECORD_TIME_KEYS));

/** A drone as the mech's object answers it, by its status, which decodes into the wire's drone. */
const DroneRecord = Schema.Union([
  Schema.Struct({
    ...DRONE_RECORD_FIELDS,
    status: Schema.Literal(DroneStatus.Running),
    cancelerId: Schema.OptionFromNullOr(Schema.String),
  }).pipe(Schema.encodeKeys(RECORD_TIME_KEYS)),
  Schema.Struct({
    ...DRONE_RECORD_FIELDS,
    status: Schema.Literal(DroneStatus.Reported),
    endedAt: Schema.DateTimeUtcFromMillis,
  }).pipe(Schema.encodeKeys(RECORD_TIME_KEYS)),
  Schema.Struct({
    ...DRONE_RECORD_FIELDS,
    status: Schema.Literal(DroneStatus.Unreported),
    endedAt: Schema.DateTimeUtcFromMillis,
    reason: Schema.Enum(UnansweredReason),
    cancelerId: Schema.OptionFromNullOr(Schema.String),
  }).pipe(Schema.encodeKeys(RECORD_TIME_KEYS)),
]);

/** A page of a mech's threads, oldest first, no mech, or a cursor that names no thread of the mech. */
export const ThreadsAnswer = Schema.TaggedUnion({
  Listed: { threads: Schema.Array(ThreadRecord), hasMore: Schema.Boolean },
  MechMissing: {},
  CursorMissing: {},
});

export type ThreadsAnswer = typeof ThreadsAnswer.Type;

/** What a drone read found: the drone and its brief, no mech, or no such drone. */
export const DroneAnswer = Schema.TaggedUnion({
  Found: { drone: DroneRecord, brief: Schema.String },
  MechMissing: {},
  DroneMissing: {},
});

export type DroneAnswer = typeof DroneAnswer.Type;

/** A page of a mech's drones, oldest first, no mech, or a cursor that names no drone of the mech. */
export const DronesAnswer = Schema.TaggedUnion({
  Listed: { drones: Schema.Array(DroneRecord), hasMore: Schema.Boolean },
  MechMissing: {},
  CursorMissing: {},
});

export type DronesAnswer = typeof DronesAnswer.Type;
