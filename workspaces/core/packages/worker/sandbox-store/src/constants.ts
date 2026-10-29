/**
 * Where an execution is: claimed and sent to no machine, sent to its machine before its receipt, or settled by it. An
 * uncertain one's machine ended without a receipt, and an unavailable one's machine never started.
 */
export const ExecutionStatus = {
  Pending: 'pending',
  Dispatched: 'dispatched',
  Exited: 'exited',
  TimedOut: 'timed_out',
  Uncertain: 'uncertain',
  Unavailable: 'unavailable',
  PersistenceFailed: 'persistence_failed',
} as const;

export type ExecutionStatus = (typeof ExecutionStatus)[keyof typeof ExecutionStatus];

/** A machine's lifecycle: asked to start, its guest answered its health, or ended, which is final. */
export const MachineStatus = { Starting: 'starting', Ready: 'ready', Ended: 'ended' } as const;

export type MachineStatus = (typeof MachineStatus)[keyof typeof MachineStatus];
