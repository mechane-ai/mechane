import type { MachineId } from '@mechane/records';
import type { DateTime } from 'effect';

export type FailMachineInput = {
  readonly machineId: MachineId;
  /** The time by which the machine had to answer its health; the executions claimed by then waited for it. */
  readonly startupDeadline: DateTime.Utc;
  readonly now: DateTime.Utc;
};

export type MachineTimeInput = { readonly machineId: MachineId; readonly now: DateTime.Utc };
