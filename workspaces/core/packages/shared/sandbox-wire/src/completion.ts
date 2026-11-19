import { MachineId } from '@mechane/records';
import { Schema } from 'effect';
import { SandboxOwner } from './sandbox-owner.ts';
import { ExecutionId } from './schemas.ts';
import { SANDBOX_SERVICE_PREFIX } from './service.ts';

export const SANDBOX_COMPLETION_PATH = '/internal/sandboxes/completions';

/** The persisted environment receipt whose terminal outcome is being delivered. */
export const SandboxCompletionKind = { Sandbox: 'sandbox', Process: 'process' } as const;

/** Terminal command and managed process outcomes use the original receipt's status. */
export const SandboxCompletionStatus = {
  Exited: 'exited',
  TimedOut: 'timed_out',
  PersistenceFailed: 'persistence_failed',
  Uncertain: 'uncertain',
  Unavailable: 'unavailable',
  Stopped: 'stopped',
  Lost: 'lost',
} as const;

export const SandboxCompletionReceipt = Schema.Struct({
  executionId: ExecutionId,
  kind: Schema.Enum(SandboxCompletionKind),
  /** Absent when a command could not acquire a machine. */
  machineId: Schema.OptionFromNullOr(MachineId),
  status: Schema.Enum(SandboxCompletionStatus),
  /** Absent unless the command or managed process exited with a code. */
  exitCode: Schema.OptionFromNullOr(Schema.Int),
});

export type SandboxCompletionReceipt = typeof SandboxCompletionReceipt.Type;

export const SandboxCompletion = Schema.Struct({ ...SandboxOwner.fields, ...SandboxCompletionReceipt.fields });
export type SandboxCompletion = typeof SandboxCompletion.Type;

export const SandboxCompletionAccepted = Schema.Struct({ accepted: Schema.Literal(true) });

export const SandboxCompletionIdentity = Schema.Struct({ ...SandboxOwner.fields, executionId: ExecutionId });

export function sandboxCompletionPath({
  workspaceId,
  mechId,
  executionId,
}: typeof SandboxCompletionIdentity.Type): string {
  return `${SANDBOX_SERVICE_PREFIX}/${encodeURIComponent(workspaceId)}/${encodeURIComponent(mechId)}/completions/${encodeURIComponent(executionId)}`;
}
