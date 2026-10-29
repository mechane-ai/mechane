import { OPEN_THREADS_PER_MECH, RUNNING_DRONES_PER_MECH } from '@mechane/protocol';

/** The tools of the threads extension, by the names pi stores in every call. */
export const ThreadTool = { Open: 'open_thread', Update: 'update_thread', StartDrone: 'start_drone' } as const;

/** How each tool explains itself to the model, the only place the model learns its rules. */
export const ThreadDescription = {
  Open: [
    'Open a thread: your record of one piece of ongoing work, which your threads section lists until you resolve it.',
    `A thread starts working, and you keep at most ${OPEN_THREADS_PER_MECH} open threads.`,
    'The thread stands however this turn ends.',
  ].join(' '),
  Update: [
    "Change a thread's state: working, waiting on someone or something, idle while set aside, or resolved, which is",
    'final. A note, if you give one, replaces what the thread says of where its work stands.',
    'The change stands however this turn ends.',
  ].join(' '),
  StartDrone: [
    'Start a drone on an open thread: a fresh agent with a sandbox of its own that works from the brief alone, reads',
    'your memory as saved now, and can neither change it nor start drones.',
    `You run at most ${RUNNING_DRONES_PER_MECH} drones at once. A drone outlives the turn that started it, and its`,
    'final reply reaches your inbox as an item once it ends.',
  ].join(' '),
} as const;

/** The codes of the errors the threads tools report, beside pi's own. */
export const ThreadDiagnostic = {
  Invalid: 'thread_invalid',
  Full: 'threads_full',
  Missing: 'thread_missing',
  Resolved: 'thread_resolved',
  DronesFull: 'drones_full',
} as const;
