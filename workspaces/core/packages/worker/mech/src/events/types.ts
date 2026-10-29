import type { MechStore } from '@mechane/mech-store';
import type { WakeList } from '@mechane/utilities';
import type { DateTime } from 'effect';

/** The store a list of events reads, the signal it waits for, the sequence it starts after, and its deadline. */
export type AwaitEventsInput = {
  readonly store: MechStore;
  readonly signal: WakeList;
  readonly after: number;
  readonly deadline: DateTime.Utc;
};
