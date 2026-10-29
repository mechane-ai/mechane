import type { DroneStatus, UnansweredReason } from '@mechane/protocol';
import type { PageAfterInput } from '@mechane/store';
import type { DateTime, Option } from 'effect';
import type {
  DroneRow,
  DroneRowPage,
  EndedDroneRow,
  RunningDroneRow,
  SessionDroneRow,
  StartedDroneRow,
} from './drone.schemas.ts';
import type { CancelRow, RefusalRow } from './schemas.ts';
import type { TaskIdInput } from './task.types.ts';

/** The drone a record function reads or changes. */
export type DroneIdInput = { readonly droneId: string };

/** A drone a start_drone task starts on a thread, with the id its report item will take. */
export type StartDroneInput = {
  readonly droneId: string;
  readonly threadId: string;
  readonly taskId: number;
  readonly brief: string;
  readonly reportInboxItemId: string;
  readonly now: DateTime.Utc;
};

/** A drone and the provider session id its conversation sends. */
export type BindDroneInput = { readonly droneId: string; readonly sessionId: string };

/** The provider session id a drone's conversation sends. */
export type SessionIdInput = { readonly sessionId: string };

/** A drone that ended with its report. */
type ReportedEnd = { readonly status: typeof DroneStatus.Reported };

/** A drone that ended without a report, for a reason. */
type UnreportedEnd = { readonly status: typeof DroneStatus.Unreported; readonly reason: UnansweredReason };

/** How a drone ended. */
type DroneEnd = ReportedEnd | UnreportedEnd;

/** A running drone to end, how, and when. */
export type EndDroneInput = { readonly droneId: string; readonly end: DroneEnd; readonly now: DateTime.Utc };

/** A step a drone takes at a time: a refusal of one of its dispatches, or the stop of its machine. */
export type DroneStepInput = { readonly droneId: string; readonly now: DateTime.Utc };

/** A member's cancel of a running drone. */
export type CancelDroneInput = { readonly droneId: string; readonly cancelerId: string; readonly now: DateTime.Utc };

/** The record functions of a mech's drones, from their start to the session they bind. */
export type DroneRecords = {
  /** The drone a start_drone task started, which a rerun of the task answers. */
  readonly startedDrone: (input: TaskIdInput) => Option.Option<StartedDroneRow>;
  /** How many of the mech's drones run. */
  readonly runningDroneCount: () => number;
  /** Records a running drone, which reads the memory its mech has saved by now. */
  readonly startDrone: (input: StartDroneInput) => void;
  /** The drone of the id, none for an id the mech never started. */
  readonly drone: (input: DroneIdInput) => Option.Option<DroneRow>;
  /** The brief of a drone the mech holds. */
  readonly droneBrief: (input: DroneIdInput) => string;
  /** A page of the mech's drones, oldest first, or a cursor that names no drone of its own. */
  readonly drones: (input: PageAfterInput) => DroneRowPage;
  /** The running drones, oldest first. */
  readonly runningDrones: () => ReadonlyArray<RunningDroneRow>;
  /** Binds the drone to its conversation's session id, once. */
  readonly bindDrone: (input: BindDroneInput) => void;
  /** The drone bound to the session id; only a drone's conversation sends one that is not its mech's. */
  readonly sessionDrone: (input: SessionIdInput) => SessionDroneRow;
};

/** The record functions of how a mech's drones end, and of the stop of each one's machine. */
export type DroneEndRecords = {
  /** Ends a running drone, and answers its thread and report item id, none when it ended before. */
  readonly endDrone: (input: EndDroneInput) => Option.Option<EndedDroneRow>;
  /** Records that the allowance refused one of the drone's dispatches. */
  readonly refuseDrone: (input: DroneStepInput) => void;
  /** The allowance's first refusal of one of the drone's dispatches, none while it refused none. */
  readonly droneRefusal: (input: DroneIdInput) => Option.Option<RefusalRow>;
  /** Records a cancel on a running drone not canceled yet. */
  readonly cancelDrone: (input: CancelDroneInput) => void;
  /** The cancel recorded on the drone, none for a drone never canceled. */
  readonly droneCancel: (input: DroneIdInput) => Option.Option<CancelRow>;
  /** The ended drones that bound a session and whose sandbox was not asked to stop yet, in the order they ended. */
  readonly unstoppedDrones: () => ReadonlyArray<string>;
  /** Records that the drone's sandbox was asked to stop its machine. */
  readonly stopDrone: (input: DroneStepInput) => void;
};
