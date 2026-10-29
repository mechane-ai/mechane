import type { Event, MemoryList, WatchList } from '@mechane/protocol';
import type { MechTurn } from '@mechane/testing';
import type { ForkRecord } from './schemas.ts';

/** The random lines the scenario's memories hold: the parent's before the fork, and the fork's after it. */
export type ForkLines = { readonly parent: string; readonly fork: string };

/**
 * What the scenario saw: the parent's turn before the fork, the new mech as the fork answered it, and the fork's turn
 * and the parent's after it. It also keeps each one's memory then, and the fork's log from the fork point on.
 */
export type ForkRun = {
  readonly saved: MechTurn;
  readonly record: ForkRecord;
  readonly recalled: MechTurn;
  readonly later: MechTurn;
  readonly forkMemory: MemoryList;
  readonly parentMemory: MemoryList;
  readonly forkLog: ReadonlyArray<Event>;
  readonly forkWatches: WatchList;
};
