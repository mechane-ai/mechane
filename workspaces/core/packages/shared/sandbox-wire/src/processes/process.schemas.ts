import { boundedText, MachineId, RecordId, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { EXECUTION_MAX_BYTES } from '../constants.ts';
import { ExecutionEnvironment } from '../execution-environment.ts';
import { ExecutionOutput } from '../schemas.ts';
import { PROCESS_HISTORY_MAX_ENTRIES, PROCESS_MAX_INSTANCES } from './constants.ts';

/** Derived native execution identity reused when rejoining the same process start. */
export const ProcessId = RecordId.pipe(Schema.brand('ProcessId'));

export type ProcessId = typeof ProcessId.Type;

/** The accepted command and explicit environment for an idempotent guest start. */
export const ProcessStart = wireStruct({
  fields: {
    processId: ProcessId,
    command: boundedText({ maxBytes: EXECUTION_MAX_BYTES }),
    /** None runs without granted variables or secrets. */
    environment: Schema.OptionFromOptionalKey(ExecutionEnvironment),
  },
});

export type ProcessStart = typeof ProcessStart.Type;

/** The original machine is part of the handle, so reads cannot address a replacement process. */
export const ProcessHandle = wireStruct({ fields: { processId: ProcessId, machineId: MachineId } });

export type ProcessHandle = typeof ProcessHandle.Type;

/** Running acknowledges creation; only Exited includes a completed command's exit code. */
export const ProcessState = Schema.TaggedUnion({
  Running: {},
  Exited: { exitCode: Schema.Int },
  Stopped: {},
  Lost: {},
});

export type ProcessState = typeof ProcessState.Type;

/** The originating turn was canceled before this process start could be admitted. */
export const ProcessCanceled = Schema.TaggedStruct('ProcessCanceled', {});
export type ProcessCanceled = typeof ProcessCanceled.Type;

/** An exact-handle read includes a bounded redacted log tail and its omitted-byte count. */
export const ProcessObservation = wireStruct({
  fields: { handle: ProcessHandle, state: ProcessState, output: ExecutionOutput },
});

export type ProcessObservation = typeof ProcessObservation.Type;

/** A list entry deliberately omits logs; callers inspect its handle to read output. */
export const ProcessSummary = wireStruct({ fields: { handle: ProcessHandle, state: ProcessState } });
export type ProcessSummary = typeof ProcessSummary.Type;

/** Every live handle plus bounded recent terminal history, rather than a complete lifetime archive. */
export const ProcessSummaries = Schema.Array(ProcessSummary).check(
  Schema.isMaxLength(PROCESS_MAX_INSTANCES + PROCESS_HISTORY_MAX_ENTRIES),
);

export type ProcessSummaries = typeof ProcessSummaries.Type;
