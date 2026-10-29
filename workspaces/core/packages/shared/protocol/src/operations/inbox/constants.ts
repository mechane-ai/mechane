/** The longest text an inbox item may carry. */
export const INBOX_TEXT_MAX_CHARS = 32_768;

/**
 * How an inbox item reaches the mech: once it is idle, or at the next pause of its running turn, which it then joins.
 * An interrupt cancels the turn running when it is received, and then waits until the mech is idle. A silent item
 * enters the mech's conversation without waking it, for its next turn to read.
 */
export const Delivery = {
  WhenIdle: 'when_idle',
  NextPause: 'next_pause',
  Interrupt: 'interrupt',
  Silent: 'silent',
} as const;

export type Delivery = (typeof Delivery)[keyof typeof Delivery];
