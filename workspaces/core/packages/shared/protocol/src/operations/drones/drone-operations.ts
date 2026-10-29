import { cancelDrone } from './cancel-drone.ts';
import { listDrones } from './list-drones.ts';
import { showDrone } from './show-drone.ts';

/** Listing, inspection and cancellation of a mech's drones. */
export const DRONE_OPERATIONS = { listDrones, showDrone, cancelDrone } as const;
