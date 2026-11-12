import type { MachineId } from '@mechane/records';
import type { ExecutionRow, ExecutionStatus, SandboxStore } from '@mechane/sandbox-store';
import type { ExecutionEnvironment, GuestStatus } from '@mechane/sandbox-wire';
import type { Duration, Option } from 'effect';
import type { GuestAnswer } from './schemas.ts';

/** A row of one status. */
export type StatusOf<S> = { readonly status: S };

/** A dispatched execution, as the store holds it, with the machine it was sent to. */
export type DispatchedExecution = Extract<ExecutionRow, StatusOf<typeof ExecutionStatus.Dispatched>>;

/** A request to a machine's guest: its path and query, below the machine's origin, and the rest of the request. */
export type GuestRequestInput = { readonly path: string; readonly init: RequestInit };

export type MachineIdInput = { readonly machineId: MachineId };

/** One machine's guest, reached by HTTP. */
export type GuestTransport = { readonly fetch: (input: GuestRequestInput) => Promise<Response> };

export type ExecuteMachineInput = {
  readonly execution: DispatchedExecution;
  /** None observes an existing command without submitting credentials. */
  readonly environment: Option.Option<ExecutionEnvironment>;
  readonly wait: Duration.Duration;
};

/** The guest's health and idempotent execution protocol, independent of its hosting service. */
export type GuestConnection = {
  readonly fetch: GuestTransport['fetch'];
  readonly startup: (input: MachineIdInput) => Promise<Option.Option<GuestStatus>>;
  readonly health: (input: MachineIdInput) => Promise<boolean>;
  readonly execute: (input: ExecuteMachineInput) => Promise<GuestAnswer>;
};

/** Starts, reaches, and stops machines; Mechane owns their workspace durability. */
export type MachineProvider = {
  /** The declared tool manifest determines the bounded cold startup deadline. */
  readonly startupTimeout: () => Duration.Duration;
  /** Starts or rejoins the identity without resetting its files; capacity owns replacement. */
  readonly start: (input: MachineIdInput) => Promise<void>;
  /** Reads the machine's guest without allocating; none before it runs and after it stops. */
  readonly connect: (input: MachineIdInput) => Promise<Option.Option<GuestConnection>>;
  /** Confirms the machine stopped. A rejection does not acknowledge stop or permit capacity release. */
  readonly stop: (input: MachineIdInput) => Promise<void>;
};

/** The object-owned bucket and namespace of every portable workspace generation. */
export type WorkspaceFiles = { readonly bucket: R2Bucket; readonly owner: string };

export type ProviderStepInput = { readonly store: SandboxStore; readonly provider: MachineProvider };

export type WorkspaceProviderStepInput = ProviderStepInput & { readonly workspace: WorkspaceFiles };
