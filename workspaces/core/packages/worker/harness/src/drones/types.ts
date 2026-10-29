import type { Harness } from '@earendil-works/pi-durable';

export type DroneIdInput = { readonly droneId: string };

/** A drone of the mech's Harness, by its id. */
export type DroneInput = DroneIdInput & { readonly harness: Harness };
