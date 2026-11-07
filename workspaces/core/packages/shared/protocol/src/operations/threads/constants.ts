/**
 * Where a thread of a mech's work is: being worked on, waiting on someone or something, set aside, or resolved, which
 * is final.
 */
export const ThreadState = { Working: 'working', Waiting: 'waiting', Idle: 'idle', Resolved: 'resolved' } as const;

export type ThreadState = (typeof ThreadState)[keyof typeof ThreadState];
