/** The longest text an inbox item may carry. */
export const INBOX_TEXT_MAX_CHARS = 32_768;

/** Accepted inputs wait until the conversation's current run finishes. */
export const Delivery = { WhenIdle: 'when_idle' } as const;

export type Delivery = (typeof Delivery)[keyof typeof Delivery];
