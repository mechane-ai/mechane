import type { ItemProgressReport } from '@mechane/harness';
import type { MechRow, RunningDroneRow } from '@mechane/mech-store';
import { Option } from 'effect';
import type { DroneLaunch } from '../types.ts';
import type { CaughtUp } from './types.ts';

type DroneWorkInput = {
  /** Absent before this durable object holds a mech, so no drone can be started. */
  readonly mech: Option.Option<MechRow>;
  readonly drones: ReadonlyArray<RunningDroneRow>;
  readonly report: ItemProgressReport;
  readonly unstopped: ReadonlyArray<string>;
};

type DroneWork = Pick<CaughtUp, 'aborts' | 'starts' | 'stops'>;

/** A projected drone end stops its machine on the next catch-up, after its report becomes durable. */
export function droneWork({ mech, drones, report, unstopped }: DroneWorkInput): DroneWork {
  const endedIds = report.droneEnds.map(({ droneId }) => droneId);
  const ended = new Set(endedIds);
  const isBriefed: (drone: RunningDroneRow) => boolean = ({ id }) => !ended.has(id) && !report.unbriefed.includes(id);
  const briefed = drones.filter(isBriefed);
  const unbriefed = drones.filter(({ id }) => report.unbriefed.includes(id));
  const starts = droneStarts({ mech, drones: unbriefed });

  return {
    aborts: briefed.filter(({ canceledAt }) => Option.isSome(canceledAt)).map(({ id }) => id),
    starts,
    stops: unstopped,
  };
}

function droneStarts({ mech, drones }: Pick<DroneWorkInput, 'mech' | 'drones'>): ReadonlyArray<DroneLaunch> {
  if (Option.isNone(mech)) {
    return [];
  }

  const modelId = mech.value.model;

  const launch: (drone: RunningDroneRow) => DroneLaunch = ({ id, brief, canceledAt }) => ({
    droneId: id,
    brief,
    modelId,
    isCanceled: Option.isSome(canceledAt),
  });

  return drones.map(launch);
}
