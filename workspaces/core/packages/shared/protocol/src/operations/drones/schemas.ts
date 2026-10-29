import {
  DroneId,
  memberOrUnknown,
  PAGE_RENAMES,
  RecordId,
  RecordText,
  renamedWireStruct,
  ThreadId,
  unknownMember,
  wireStruct,
} from '@mechane/records';
import { Schema } from 'effect';
import { UnknownFields, WireTime } from '../../schemas.ts';
import { UnansweredReason } from '../turns/constants.ts';
import { TracedDispatch } from '../turns/schemas.ts';
import { DroneStatus } from './constants.ts';

/** The path of one drone of a mech. */
export const DronePath = wireStruct({ fields: { workspaceId: RecordId, mechId: RecordId, droneId: DroneId } });

export type DronePath = typeof DronePath.Type;

/** The fields of a drone in each of its states: the thread it works on, and when it started. */
const DRONE_FIELDS = { id: DroneId, threadId: ThreadId, startedAt: WireTime } as const;

/**
 * A drone a mech started on one of its threads, by its status, and the member who canceled it, none while none did; a
 * reported drone was never canceled.
 */
export const Drone = Schema.Union([
  wireStruct({
    fields: {
      ...DRONE_FIELDS,
      status: Schema.Literal(DroneStatus.Running),
      /** None while no member canceled the drone, which the wire sends as null. */
      cancelerId: Schema.OptionFromNullOr(RecordId),
    },
  }),
  wireStruct({ fields: { ...DRONE_FIELDS, status: Schema.Literal(DroneStatus.Reported), endedAt: WireTime } }),
  wireStruct({
    fields: {
      ...DRONE_FIELDS,
      status: Schema.Literal(DroneStatus.Unreported),
      endedAt: WireTime,
      reason: memberOrUnknown({ set: UnansweredReason }),
      /** None unless a member canceled the drone, which the wire sends as null. */
      cancelerId: Schema.OptionFromNullOr(RecordId),
    },
  }),
]);

export type Drone = typeof Drone.Type;

/**
 * A drone in a status a newer deployment added, which this release does not know: its id, thread and status, and its
 * other fields as the wire wrote them.
 */
export const UnknownDrone = Schema.StructWithRest(
  Schema.Struct({ id: DroneId, thread_id: ThreadId, status: unknownMember({ set: DroneStatus }) }),
  [UnknownFields],
);

export type UnknownDrone = typeof UnknownDrone.Type;

/** A drone as a list or a trace answers it: in a status this release knows, or in a newer deployment's. */
const ListedDrone = Schema.Union([Drone, UnknownDrone]);

/** A mech's drones, oldest first. */
export const DroneList = Schema.Struct({ drones: Schema.Array(ListedDrone) });

export type DroneList = typeof DroneList.Type;

/** One page of a mech's drones, oldest first, and whether more follow it. */
export const DronePage = renamedWireStruct({
  fields: { ...DroneList.fields, hasMore: Schema.Boolean },
  renames: PAGE_RENAMES,
});

export type DronePage = typeof DronePage.Type;

/**
 * A drone, the brief its mech gave it, and its dispatches, in the order they were decided, which count against its
 * mech's cap.
 */
export const DroneTrace = Schema.Struct({
  drone: ListedDrone,
  brief: RecordText,
  dispatches: Schema.Array(TracedDispatch),
});

export type DroneTrace = typeof DroneTrace.Type;

/** A cancel the mech recorded on a drone, when and by whom; the drone ends unreported, `canceled`, once it stops. */
export const DroneCancel = wireStruct({ fields: { droneId: DroneId, canceledAt: WireTime, cancelerId: RecordId } });

export type DroneCancel = typeof DroneCancel.Type;
