import { DroneStatus, UnansweredReason } from '@mechane/protocol';
import { DroneId, renamedWireStruct, ThreadId, wireStruct } from '@mechane/records';
import { Schema } from 'effect';

/** The thread an ended drone worked on, and the id its report item takes. */
export const EndedDroneRow = wireStruct({ fields: { threadId: ThreadId, reportInboxItemId: Schema.String } });

export type EndedDroneRow = typeof EndedDroneRow.Type;

/** The drone a start_drone task recorded and the thread it works on, which a rerun of the task answers. */
export const StartedDroneRow = wireStruct({ fields: { id: DroneId, threadId: ThreadId } });

export type StartedDroneRow = typeof StartedDroneRow.Type;

/** The drone whose conversation sends a session id, and the newest memory version it reads. */
export const SessionDroneRow = wireStruct({ fields: { id: DroneId, memoryVersion: Schema.Int } });

export type SessionDroneRow = typeof SessionDroneRow.Type;

/** A running drone as the alarm starts or aborts it: its brief, and when a member canceled it. */
export const RunningDroneRow = renamedWireStruct({
  fields: {
    id: DroneId,
    brief: Schema.String,
    /** Absent while no member canceled the drone. */
    canceledAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
  },
  renames: { canceledAt: 'canceled_at_ms' },
});

export type RunningDroneRow = typeof RunningDroneRow.Type;

/** The fields of a drone in each of its states: the thread it works on, and when it started. */
const DRONE_FIELDS = { id: DroneId, threadId: ThreadId, startedAt: Schema.DateTimeUtcFromMillis } as const;

/** The columns of a drone's times, which hold milliseconds since the epoch. */
const DRONE_TIME_COLUMNS = { startedAt: 'started_at_ms', endedAt: 'ended_at_ms' } as const;

/** A drone as its mech lists it, by its status; a reported drone was never canceled. */
export const DroneRow = Schema.Union([
  renamedWireStruct({
    fields: {
      ...DRONE_FIELDS,
      status: Schema.Literal(DroneStatus.Running),
      /** None while no member canceled the drone. */
      cancelerId: Schema.OptionFromNullOr(Schema.String),
    },
    renames: { startedAt: DRONE_TIME_COLUMNS.startedAt },
  }),
  renamedWireStruct({
    fields: { ...DRONE_FIELDS, status: Schema.Literal(DroneStatus.Reported), endedAt: Schema.DateTimeUtcFromMillis },
    renames: DRONE_TIME_COLUMNS,
  }),
  renamedWireStruct({
    fields: {
      ...DRONE_FIELDS,
      status: Schema.Literal(DroneStatus.Unreported),
      endedAt: Schema.DateTimeUtcFromMillis,
      reason: Schema.Enum(UnansweredReason),
      /** None for a drone that ended without a member's cancel. */
      cancelerId: Schema.OptionFromNullOr(Schema.String),
    },
    renames: DRONE_TIME_COLUMNS,
  }),
]);

export type DroneRow = typeof DroneRow.Type;

/** A page of the mech's drones as the store reads them, oldest first, or a cursor that names no drone of its own. */
export const DroneRowPage = Schema.TaggedUnion({
  Listed: { drones: Schema.Array(Schema.toType(DroneRow)), hasMore: Schema.Boolean },
  CursorMissing: {},
});

export type DroneRowPage = typeof DroneRowPage.Type;
