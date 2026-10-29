/**
 * Where a drone is: working on its brief, ended with a report its mech received, or ended without one, for the reason a
 * turn would give.
 */
export const DroneStatus = { Running: 'running', Reported: 'reported', Unreported: 'unreported' } as const;

export type DroneStatus = (typeof DroneStatus)[keyof typeof DroneStatus];

/** The most drones a mech keeps running at once, each with a sandbox of its own. */
export const RUNNING_DRONES_PER_MECH = 4;
