import type { SandboxReport, SandboxRequest } from '@mechane/protocol';
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

/** How a sandbox reaches the machines its guest runs on; the only code that differs between the two providers. */
export type MachineProvider = {
  /** None for local providers, whose workspaces have no remote lifecycle. */
  readonly manage: Option.Option<(request: SandboxRequest) => Promise<SandboxReport>>;
  /** Absent for providers whose idle machines must stop and lose their in-memory receipts. */
  readonly suspend: Option.Option<(input: MachineIdInput) => Promise<void>>;
  /** Starts the machine, with its id in its guest's start, after stopping any machine still running. */
  readonly start: (input: MachineIdInput) => Promise<void>;
  /** The machine's guest while the machine runs; none before it runs and once it stopped. */
  readonly connect: (input: MachineIdInput) => Promise<Option.Option<GuestConnection>>;
  /** Stops the machine, if it runs. */
  readonly stop: (input: MachineIdInput) => Promise<void>;
};

/** The sandbox's store, and the provider its machines run on, which every step of an execution works through. */
export type WorkspaceFiles = { readonly bucket: R2Bucket; readonly owner: string };

export type ProviderStepInput = { readonly store: SandboxStore; readonly provider: MachineProvider };

export type WorkspaceProviderStepInput = ProviderStepInput & {
  /** Absent when the selected provider owns native persistent files instead of portable snapshots. */
  readonly workspace: Option.Option<WorkspaceFiles>;
};

/** A restored guest generation that has not run any untrusted command. */
export type FreshSourceMachine = { readonly machineId: GuestStart['machineId']; readonly guest: GuestConnection };

/** A provider step with portable workspace storage available. */
export type WorkspaceTransferInput = ProviderStepInput & { readonly workspace: WorkspaceFiles };
