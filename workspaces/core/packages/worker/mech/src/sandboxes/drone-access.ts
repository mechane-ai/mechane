import type { MechTables } from '@mechane/mech-store';
import { DroneStatus } from '@mechane/protocol';
import type { DroneId } from '@mechane/records';
import { Option } from 'effect';
import { SandboxAccess } from './constants.ts';

type DroneAccessInput = { readonly store: MechTables; readonly droneId: DroneId; readonly isInspection: boolean };

/** A drone's files belong to its mech even after the drone finishes. */
export function droneAccess({ store, droneId, isInspection }: DroneAccessInput): SandboxAccess {
  const drone = store.drone({ droneId });

  if (Option.isNone(drone)) {
    return SandboxAccess.Missing;
  }

  if (!isInspection && drone.value.status === DroneStatus.Running) {
    return SandboxAccess.Busy;
  }

  return SandboxAccess.Ready;
}
