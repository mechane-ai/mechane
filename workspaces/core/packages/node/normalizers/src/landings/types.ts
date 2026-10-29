import type { Unit } from '@mechane/modules';

/** The units landing in one file in dependency order, and the names of those that name each other. */
export type LandingOrder = { readonly units: ReadonlyArray<Unit>; readonly cyclic: ReadonlySet<string> };
