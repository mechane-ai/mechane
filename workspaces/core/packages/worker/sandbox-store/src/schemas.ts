import { Bytes, renamedWireStruct } from '@mechane/records';
import { ExecutionId } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { ExecutionStatus, MachineStatus } from './constants.ts';

/** The machine that may still run: starting, or ready; at most one is. */
export const LiveMachineRow = renamedWireStruct({
  fields: {
    id: Schema.String,
    status: Schema.Literals([MachineStatus.Starting, MachineStatus.Ready]),
    startedAt: Schema.DateTimeUtcFromMillis,
  },
  renames: { startedAt: 'started_at_ms' },
});

export type LiveMachineRow = typeof LiveMachineRow.Type;

/** The request every execution holds, which a repeat of its id must match. */
const REQUEST_FIELDS = { id: ExecutionId, command: Schema.String, timeout: Schema.DurationFromMillis } as const;

/** The column of the request's timeout, which counts milliseconds. */
const REQUEST_RENAMES = { timeout: 'timeout_ms' } as const;

/** The stored output of a settled execution. */
const OUTPUT_FIELDS = { duration: Schema.DurationFromMillis, outputText: Schema.String, omittedBytes: Bytes } as const;

/** The columns of the request's timeout and the output's duration, which count milliseconds. */
const OUTPUT_RENAMES = { ...REQUEST_RENAMES, duration: 'duration_ms' } as const;

/** An execution as the sandbox stores it, by its status: the columns its status has not filled are null. */
export const ExecutionRow = Schema.Union([
  renamedWireStruct({
    fields: {
      ...REQUEST_FIELDS,
      ...OUTPUT_FIELDS,
      status: Schema.Literal(ExecutionStatus.PersistenceFailed),
      reason: Schema.String,
    },
    renames: { ...OUTPUT_RENAMES, reason: 'persistence_failure' },
  }),
  renamedWireStruct({
    fields: { ...REQUEST_FIELDS, status: Schema.Literal(ExecutionStatus.Pending) },
    renames: REQUEST_RENAMES,
  }),
  renamedWireStruct({
    fields: {
      ...REQUEST_FIELDS,
      status: Schema.Literal(ExecutionStatus.Dispatched),
      machineId: Schema.String,
      dispatchedAt: Schema.DateTimeUtcFromMillis,
    },
    renames: { ...REQUEST_RENAMES, dispatchedAt: 'dispatched_at_ms' },
  }),
  renamedWireStruct({
    fields: {
      ...REQUEST_FIELDS,
      ...OUTPUT_FIELDS,
      status: Schema.Literal(ExecutionStatus.Exited),
      exitCode: Schema.Int,
    },
    renames: OUTPUT_RENAMES,
  }),
  renamedWireStruct({
    fields: { ...REQUEST_FIELDS, ...OUTPUT_FIELDS, status: Schema.Literal(ExecutionStatus.TimedOut) },
    renames: OUTPUT_RENAMES,
  }),
  renamedWireStruct({
    fields: { ...REQUEST_FIELDS, status: Schema.Literal(ExecutionStatus.Uncertain) },
    renames: REQUEST_RENAMES,
  }),
  renamedWireStruct({
    fields: { ...REQUEST_FIELDS, status: Schema.Literal(ExecutionStatus.Unavailable) },
    renames: REQUEST_RENAMES,
  }),
]);

export type ExecutionRow = typeof ExecutionRow.Type;

/** A machine's id. */
export const MachineIdRow = Schema.Struct({ id: Schema.String });

export type MachineIdRow = typeof MachineIdRow.Type;
