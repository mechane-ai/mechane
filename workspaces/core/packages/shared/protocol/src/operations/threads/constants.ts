/**
 * Where a thread of a mech's work is: being worked on, waiting on someone or something, set aside, or resolved, which
 * is final.
 */
export const ThreadState = { Working: 'working', Waiting: 'waiting', Idle: 'idle', Resolved: 'resolved' } as const;

export type ThreadState = (typeof ThreadState)[keyof typeof ThreadState];

/** The longest title a thread may have, in characters: its mech's prompt lists every open thread by it. */
export const THREAD_TITLE_MAX_CHARS = 120;

/** The longest note a thread may carry, in characters: what its mech last wrote of where the work stands. */
export const THREAD_NOTE_MAX_CHARS = 280;

/** The most threads a mech keeps open, since its prompt lists every open one in every request. */
export const OPEN_THREADS_PER_MECH = 32;
