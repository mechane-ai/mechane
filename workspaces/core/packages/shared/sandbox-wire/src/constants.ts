import { BYTES_PER_KIBIBYTE, BYTES_PER_MEBIBYTE } from '@mechane/records';
import { Duration } from 'effect';

/** The port a container's guest listens on, which its image exposes and its sandbox reaches through `getTcpPort`. */
export const GUEST_PORT = 8080;

/**
 * The segments of the guest's two routes, each below the machine it serves: `/machines/:machine_id/health`, and
 * `/machines/:machine_id/executions/:execution_id`. The host launcher's one route is `/machines/:machine_id`.
 */
export const GuestSegment = {
  Machines: 'machines',
  Health: 'health',
  Executions: 'executions',
  Workspace: 'workspace',
  Source: 'source',
} as const;

/** The independent operations of the portable archive and restoration protocol. */
export const WorkspaceStep = { Archive: 'archive', Part: 'part', Restore: 'restore', Release: 'release' } as const;

export type WorkspaceStep = (typeof WorkspaceStep)[keyof typeof WorkspaceStep];

/** The process isolation capability explicitly selected by the guest launcher. */
export const GuestScope = { Container: 'container', Process: 'process' } as const;

/** The largest uncompressed tar stream accepted for a portable checkpoint. */
export const WORKSPACE_MAX_BYTES = 512 * BYTES_PER_MEBIBYTE;
/** The largest compressed archive accepted for a portable checkpoint. */
export const WORKSPACE_ARCHIVE_MAX_BYTES = 256 * BYTES_PER_MEBIBYTE;

/** The variables a provider starts a guest with, keyed by the guest's settings field. */
export const GUEST_VARIABLES = {
  machineId: 'MECHANE_GUEST_MACHINE_ID',
  scope: 'MECHANE_GUEST_SCOPE',
  host: 'MECHANE_GUEST_HOST',
  port: 'MECHANE_GUEST_PORT',
} as const;

/**
 * The variables every execution sees with fixed values, beside the guest's `PATH` and its home as `HOME`, and none
 * other. With them git never prompts for a credential and reads no system configuration.
 */
export const EXECUTION_VARIABLES = { LANG: 'C.UTF-8', GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1' } as const;

/** What an execution's id starts with, before the number of the pi tool task it derives from. */
export const EXECUTION_ID_PREFIX = 'task-';

/**
 * The most bash text one execution runs, in UTF-8 bytes: half the 128 KiB the kernel takes in one argument. Bash
 * receives the text as one argument, so a text this schema admits always starts.
 */
export const EXECUTION_MAX_BYTES = 64 * BYTES_PER_KIBIBYTE;

/** How long an execution may run when its caller names no timeout. */
export const DEFAULT_EXECUTION_TIMEOUT = Duration.minutes(2);

/** The longest an execution may ask to run. */
export const EXECUTION_TIMEOUT_MAX = Duration.minutes(10);

/** The longest one request waits for its execution to settle before it answers that it still runs. */
export const EXECUTION_WAIT_MAX = Duration.seconds(20);

/** The tail of an execution's combined output a receipt keeps: pi's own bound on a tool's output, 50 KiB. */
export const OUTPUT_TAIL_BYTES = 50 * BYTES_PER_KIBIBYTE;

/** Where an execution is, as its receipt reports it. */
export const ReceiptStatus = { Running: 'running', Exited: 'exited', TimedOut: 'timed_out' } as const;

export type ReceiptStatus = (typeof ReceiptStatus)[keyof typeof ReceiptStatus];

/** Where a host machine is, as the host launcher reports it, the way `ctx.container.running` reports a container. */
export const HostMachineStatus = { Starting: 'starting', Running: 'running', Exited: 'exited' } as const;

export type HostMachineStatus = (typeof HostMachineStatus)[keyof typeof HostMachineStatus];
