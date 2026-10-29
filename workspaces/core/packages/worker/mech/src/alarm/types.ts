import type { DeliverInput, OwedNote } from '@mechane/harness';
import type { DroneLaunch } from '../types.ts';

/**
 * What the alarm owes pi and the sandboxes: notes of turns to close, canceled drones to abort, items and drone briefs
 * pi lacks, and ended drones whose machines to stop.
 */
export type CaughtUp = {
  readonly isIndexDue: boolean;
  readonly notes: ReadonlyArray<OwedNote>;
  readonly aborts: ReadonlyArray<string>;
  readonly deliveries: ReadonlyArray<DeliverInput>;
  readonly starts: ReadonlyArray<DroneLaunch>;
  readonly stops: ReadonlyArray<string>;
};

/** What a catch-up found, which the alarm applies. */
export type CaughtUpInput = { readonly caught: CaughtUp };
