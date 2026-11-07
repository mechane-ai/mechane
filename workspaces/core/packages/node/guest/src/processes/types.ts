import type {
  ExecutionOutput,
  ProcessHandle,
  ProcessId,
  ProcessObservation,
  ProcessStart,
  ProcessState,
  ProcessSummary,
} from '@mechane/sandbox-wire';
import type { Deferred, Effect, MutableRef, Option } from 'effect';
import type { BashRun } from '../executions/types.ts';
import type { ProcessFailed } from './process-failed.ts';

/** Identifies a process in this guest without selecting another machine. */
export type ProcessIdInput = { readonly processId: ProcessId };

/** The guest's admitted process identities, lifecycle operations, and bounded summary list. */
export type ProcessLedger = {
  readonly start: (request: ProcessStart) => Effect.Effect<ProcessObservation, ProcessFailed>;
  /** None means this guest never admitted that process identity. */
  readonly read: (input: ProcessIdInput) => Effect.Effect<Option.Option<ProcessObservation>>;
  /** None means no process with this identity exists to stop. */
  readonly stop: (input: ProcessIdInput) => Effect.Effect<Option.Option<ProcessObservation>, ProcessFailed>;
  readonly list: () => ReadonlyArray<ProcessSummary>;
  readonly ownedProcessGroups: () => ReadonlyArray<number>;
};

/** A start receipt and settlement barrier retained after the process leaves the live set. */
export type ManagedProcess = {
  readonly handle: ProcessHandle;
  readonly fingerprint: string;
  readonly ready: Deferred.Deferred<void>;
  readonly settled: Deferred.Deferred<void>;
  readonly state: MutableRef.MutableRef<ManagedProcessState>;
};

/** The mutable execution state behind one immutable process handle. */
export type ManagedProcessState = {
  /** None before successful spawn and after process-group cleanup completes. */
  readonly run: Option.Option<BashRun>;
  readonly outcome: ProcessState;
  readonly readOutput: () => ExecutionOutput;
  readonly isStopRequested: boolean;
};
