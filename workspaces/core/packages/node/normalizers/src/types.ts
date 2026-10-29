import type { Unit } from '@mechane/modules';

/** An import of the file graph, from the importing file to the file it imports, both relative to the workspace. */
export type FileEdge = { readonly from: string; readonly to: string };

/** Where a unit lands: the offset whose line it follows, and whether that keeps it after and before what it must be. */
export type Landing = { readonly unit: Unit; readonly offset: number; readonly isOrdered: boolean };
