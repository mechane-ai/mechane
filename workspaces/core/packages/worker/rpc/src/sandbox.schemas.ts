import { SandboxReport } from '@mechane/protocol';
import { DroneId } from '@mechane/records';
import { ExecutionAttempt, SourceFenceReport, SourceGuestAnswer } from '@mechane/sandbox-wire';
import { Schema } from 'effect';

/** The mech authorizes ownership before reaching a sandbox object. */
export const SandboxAnswer = Schema.TaggedUnion({
  Found: { report: SandboxReport },
  MechMissing: {},
  DroneMissing: { droneId: DroneId },
  Busy: {},
  Disabled: {},
  CapacityReached: {},
});

export type SandboxAnswer = typeof SandboxAnswer.Type;

/** Admission failed without claiming that a command or file operation completed. */
export const MachineRefusal = Schema.TaggedUnion({ Disabled: {}, CapacityReached: {} });
export type MachineRefusal = typeof MachineRefusal.Type;

/** A persisted command result, ongoing execution, or a retryable machine refusal. */
export const SandboxExecutionAnswer = Schema.Union([ExecutionAttempt, MachineRefusal]);
export type SandboxExecutionAnswer = typeof SandboxExecutionAnswer.Type;

/** Source credential and file state remains independent of transient capacity refusal. */
export const SandboxSourceAnswer = Schema.Union([SourceFenceReport, MachineRefusal]);
export type SandboxSourceAnswer = typeof SandboxSourceAnswer.Type;

/** A selected patch capture can be retried when machine admission changes. */
export const SandboxCaptureAnswer = Schema.Union([SourceGuestAnswer, MachineRefusal]);
export type SandboxCaptureAnswer = typeof SandboxCaptureAnswer.Type;
