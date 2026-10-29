import { DroneStatus, UnknownDrone } from '@mechane/protocol';
import type { Drone } from '@mechane/protocol';
import { DateTime, Schema } from 'effect';
import { UNKNOWN_KIND_NOTE } from '../constants.ts';
import { cancelerClause } from './canceler-clause.ts';

type DroneLineInput = { readonly drone: Drone | UnknownDrone };

/** A drone's line up to its status, and the drone, which ended unreported. */
type UnreportedLineInput = { readonly heading: string; readonly drone: Extract<Drone, UnreportedStatus> };

/** The status of a drone that ended without a report. */
type UnreportedStatus = { readonly status: typeof DroneStatus.Unreported };

/**
 * One drone as a person reads it: its id, status and thread, when it started and ended, why, and who canceled it. A
 * drone in a status this release does not know shows only the first three.
 */
export function droneLine({ drone }: DroneLineInput): string {
  if (Schema.is(UnknownDrone)(drone)) {
    return `${drone.id} ${drone.status} on thread ${drone.thread_id}, ${UNKNOWN_KIND_NOTE}`;
  }

  const heading = `${drone.id} ${drone.status} on thread ${drone.threadId}, started ${DateTime.formatIso(drone.startedAt)}`;

  switch (drone.status) {
    case DroneStatus.Running:
      return `${heading}${cancelerClause(drone)}`;
    case DroneStatus.Reported:
      return `${heading}, ended ${DateTime.formatIso(drone.endedAt)}`;
    case DroneStatus.Unreported:
      return unreportedLine({ heading, drone });
  }
}

/** A drone that ended without a report: when it ended, why, and who canceled it. */
function unreportedLine({ heading, drone }: UnreportedLineInput): string {
  return `${heading}, ended ${DateTime.formatIso(drone.endedAt)} (${drone.reason})${cancelerClause(drone)}`;
}
