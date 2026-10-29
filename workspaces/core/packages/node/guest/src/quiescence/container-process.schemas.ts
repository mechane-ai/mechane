import { Schema } from 'effect';

/** The identity, owner and lifecycle fields used to identify command processes. */
export const ContainerProcess = Schema.Struct({
  Pid: Schema.NumberFromString,
  PPid: Schema.NumberFromString,
  Uid: Schema.String,
  State: Schema.String,
});

export type ContainerProcess = typeof ContainerProcess.Type;

const ProcessErrorCode = { FileGone: 'ENOENT', ProcessGone: 'ESRCH' } as const;

/** Filesystem and signal errors that mean an enumerated process already exited. */
export const ProcessDisappeared = Schema.Struct({ code: Schema.Enum(ProcessErrorCode) });

export type ProcessDisappeared = typeof ProcessDisappeared.Type;
