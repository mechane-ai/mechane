import type { ThreadState } from '@mechane/protocol';
import type { Option } from 'effect';
import type { DroneStart, ThreadChange, ThreadOpening } from '../types.ts';
import type { DroneStartOutcome, ThreadChangeOutcome, ThreadOpeningOutcome } from './schemas.ts';

/** A thread not resolved yet, as the threads section lists it, with how many of its drones run. */
export type OpenThread = {
  readonly id: string;
  readonly title: string;
  readonly state: ThreadState;
  /** Where the thread's work stands, as its last note says; none before any note. */
  readonly note: Option.Option<string>;
  readonly runningDrones: number;
};

/** A mech's threads and drones as the harness's tools and section reach them. No pi type crosses it. */
export type MechThreads = {
  readonly open: (input: ThreadOpening) => Promise<ThreadOpeningOutcome>;
  readonly update: (input: ThreadChange) => Promise<ThreadChangeOutcome>;
  /** Records the drone for the alarm to start, and its event; it never calls pi. */
  readonly startDrone: (input: DroneStart) => Promise<DroneStartOutcome>;
  readonly openThreads: () => Promise<ReadonlyArray<OpenThread>>;
};

export type ThreadsInput = { readonly threads: MechThreads };
