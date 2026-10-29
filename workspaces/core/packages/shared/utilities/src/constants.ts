/** How a wait of a wake list ended: a wake released it, its timeout passed, its stop settled, or it was canceled. */
export const WaitEnd = { Woken: 'woken', TimedOut: 'timed_out', Stopped: 'stopped', Canceled: 'canceled' } as const;

export type WaitEnd = (typeof WaitEnd)[keyof typeof WaitEnd];
