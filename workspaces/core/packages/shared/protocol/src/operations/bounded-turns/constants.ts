/** A bounded submission waits, executes, or retains its terminal outcome. */
export const BoundedTurnStatus = {
  Queued: 'queued',
  Running: 'running',
  Answered: 'answered',
  Unanswered: 'unanswered',
} as const;

export type BoundedTurnStatus = (typeof BoundedTurnStatus)[keyof typeof BoundedTurnStatus];

/** Evidence distinguishes known outcomes from an exchange whose result was lost. */
export const BoundedCallStatus = {
  Running: 'running',
  Completed: 'completed',
  Failed: 'failed',
  Unknown: 'unknown',
} as const;

export type BoundedCallStatus = (typeof BoundedCallStatus)[keyof typeof BoundedCallStatus];

/** Bounded submissions retain the limit that stopped their execution. */
export const BoundedTurnLimitReason = {
  DeadlineExceeded: 'deadline_exceeded',
  DispatchLimit: 'dispatch_limit',
} as const;

/** The HTTP boundary limits the dispatch count of each new submission. */
export const BOUNDED_TURN_MAX_DISPATCHES = 100;

/** Each provider request receives at most this admitted output-token limit. */
export const BOUNDED_TURN_MAX_OUTPUT_TOKENS = 65_536;
