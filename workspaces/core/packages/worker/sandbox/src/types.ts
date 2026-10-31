import type { ExecutionRow, ExecutionStatus, SandboxStore } from '@mechane/sandbox-store';
import type { GuestStart } from '@mechane/sandbox-wire';
import type { Duration, Option } from 'effect';
import type { GuestAnswer } from './schemas.ts';

/** A row of one status. */
export type StatusOf<S> = { readonly status: S };

/** A dispatched execution, as the store holds it, with the machine it was sent to. */
export type DispatchedExecution = Extract<ExecutionRow, StatusOf<typeof ExecutionStatus.Dispatched>>;

/** A request to a machine's guest: its path and query, below the machine's origin, and the rest of the request. */
export type GuestRequestInput = { readonly path: string; readonly init: RequestInit };

export type MachineIdInput = { readonly machineId: GuestStart['machineId'] };

/** One machine's guest, reached by HTTP. */
export type GuestTransport = { readonly fetch: (input: GuestRequestInput) => Promise<Response> };

export type ExecuteMachineInput = { readonly execution: DispatchedExecution; readonly wait: Duration.Duration };

/** The guest's health and idempotent execution protocol, independent of its hosting service. */
export type GuestConnection = {
  readonly fetch: GuestTransport['fetch'];
  readonly health: (input: MachineIdInput) => Promise<boolean>;
  readonly execute: (input: ExecuteMachineInput) => Promise<GuestAnswer>;
};

/** Starts, reaches, and stops machines; Mechane owns their workspace durability. */
export type MachineProvider = {
  /** Starts the machine, with its id in its guest's start, after stopping any machine still running. */
  readonly start: (input: MachineIdInput) => Promise<void>;
  /** The machine's guest while the machine runs; none before it runs and once it stopped. */
  readonly connect: (input: MachineIdInput) => Promise<Option.Option<GuestConnection>>;
  /** Stops the machine, if it runs. */
  readonly stop: (input: MachineIdInput) => Promise<void>;
};

/** The object-owned bucket and namespace of every portable workspace generation. */
export type WorkspaceFiles = { readonly bucket: R2Bucket; readonly owner: string };

export type ProviderStepInput = { readonly store: SandboxStore; readonly provider: MachineProvider };

export type WorkspaceProviderStepInput = ProviderStepInput & { readonly workspace: WorkspaceFiles };

/** A restored guest generation that has not run any untrusted command. */
export type FreshSourceMachine = { readonly machineId: GuestStart['machineId']; readonly guest: GuestConnection };
