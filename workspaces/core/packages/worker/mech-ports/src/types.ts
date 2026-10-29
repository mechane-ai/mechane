import type { DispatchMeter } from '@mechane/harness';
import type { DateTime } from 'effect';

/** The mark a send, a cancel, a drone's start or end, or a turn's unanswered end leaves for the alarm's work. */
export type RecordedSignal = {
  readonly mark: () => void;
  /** Answers whether work was marked since the last take, and clears it. */
  readonly take: () => boolean;
};

/** A mech's meter: the port its Harness reserves through, and the drain the alarm starts before it hands pi on. */
export type MechMeter = DispatchMeter & {
  /**
   * Holds every later dispatch until pi aborts its request, and answers how many dispatches stay open once none does,
   * or at the deadline.
   */
  readonly drain: (input: DrainInput) => Promise<number>;
};

/** When a drain stops waiting for the open dispatches. */
type DrainInput = { readonly deadline: DateTime.Utc };
