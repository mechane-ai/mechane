import type { HandsExecution } from '@mechane/harness-tools';
import type { SandboxRpc, WorkspaceRpc } from '@mechane/rpc';

/**
 * The sandbox a command runs in, by its mech's or drone's id, with the mech and the workspace whose machines it leases.
 * It holds the machines that workspace may run at once.
 */
export type MachineTarget = {
  readonly workspaceId: string;
  readonly mechId: string;
  readonly sandboxId: string;
  readonly machines: number;
};

/** The sandbox and the workspace of one execution, its target, and how its tool call ends early. */
export type SettledExecutionInput = {
  readonly sandbox: DurableObjectStub<SandboxRpc>;
  readonly workspace: DurableObjectStub<WorkspaceRpc>;
  readonly target: MachineTarget;
  readonly execution: HandsExecution;
  /** The tool call's abort signal, one that never aborts for a call without one. */
  readonly signal: AbortSignal;
  /** Resolves once the tool call is aborted, so a wait for the sandbox's answer ends with it. */
  readonly aborted: Promise<void>;
};
