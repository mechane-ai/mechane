import { DroneAnswer } from '@mechane/rpc';
import { Option } from 'effect';
import type { TablesInput } from '../types.ts';

/** The tables a drone is read from, and the drone. */
type ReadDroneInput = TablesInput & { readonly droneId: string };

/** One drone of the mech and its brief, read in one transaction. */
export function readDrone({ store, droneId }: ReadDroneInput): DroneAnswer {
  const drone = store.drone({ droneId });

  if (Option.isNone(store.mech())) {
    return DroneAnswer.cases.MechMissing.make({});
  }

  if (Option.isNone(drone)) {
    return DroneAnswer.cases.DroneMissing.make({});
  }

  return DroneAnswer.cases.Found.make({ drone: drone.value, brief: store.droneBrief({ droneId }) });
}
