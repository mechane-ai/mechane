import type { Duration, Option } from 'effect';
import type { WaitEnd } from './constants.ts';

export type TextInput = { readonly text: string };

/** A signal whose abortion ends a wait. */
export type AbortInput = { readonly signal: AbortSignal };

/** A promise, and what runs once it settles in the way the function names. */
export type SettleRunInput<A> = { readonly promise: Promise<A>; readonly run: () => void };

/** How long a wait of a wake list lasts, and what else ends it. */
export type WakeWaitInput = {
  /** The longest the wait lasts; none waits for a wake, a stop or a cancel alone. */
  readonly timeout: Option.Option<Duration.Duration>;
  /** A promise whose settling ends the wait; none when only a wake, the timeout or a cancel ends it. */
  readonly stop: Option.Option<Promise<unknown>>;
};

/** A registered wait: how it ended once it does, and its cancel, which ends it at once. */
export type WakeWait = { readonly ended: Promise<WaitEnd>; readonly cancel: () => void };

/** Waits that one wake releases together, each of which its timeout, its stop or its cancel also ends. */
export type WakeList = {
  /** Releases every wait registered now. */
  readonly wake: () => void;
  /** Registers a wait for the next wake. */
  readonly wait: (input: WakeWaitInput) => WakeWait;
};
