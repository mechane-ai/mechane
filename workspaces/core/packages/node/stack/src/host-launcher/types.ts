import type { RecordId } from '@mechane/records';
import type { GuestStart, HostMachine } from '@mechane/sandbox-wire';
import type { Effect } from 'effect';

/** A machine's id, as the launcher's path names it. */
export type MachineIdInput = { readonly machineId: RecordId };

/** A machine's start: its id, and the variables its guest starts with. */
export type ReportInput = { readonly machineId: RecordId; readonly environment: GuestStart };

/** The machines of the launcher, each started once. */
export type HostMachines = {
  /** Starts the machine the first time its id comes, and reports its state each time. */
  readonly report: (input: ReportInput) => HostMachine;
  /** Asks a machine's guest to stop, which stops every execution still running on it. */
  readonly stop: (input: MachineIdInput) => void;
  /** Stops every machine's guest, with SIGKILL for one that outlives the grace. */
  readonly stopEach: () => Effect.Effect<void>;
};
