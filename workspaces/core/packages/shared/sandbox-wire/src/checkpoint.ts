import { MachineId, RecordId, RecordText, SandboxOperationId } from '@mechane/records';
import { Schema } from 'effect';
import { SandboxServiceIdentity, sandboxWorkspacePath } from './service.ts';

export const SandboxCheckpointIdentity = Schema.Struct({
  ...SandboxServiceIdentity.fields,
  operationId: SandboxOperationId,
});

export const SandboxCheckpointResult = Schema.TaggedUnion({
  Pending: {},
  Committed: { generation: RecordId },
  Unallocated: {},
  Failed: { reason: RecordText },
});

export type SandboxCheckpointResult = typeof SandboxCheckpointResult.Type;

/** Absence means no activation file barrier was admitted under the inspected identity. */
export const SandboxCheckpointObservation = Schema.OptionFromNullOr(SandboxCheckpointResult);

/** Operator observations fence a retry to the original quiet guest and its retained files. */
export const SandboxRecoveryCheckpointRequest = Schema.Struct({
  machineId: MachineId,
  recoveryGeneration: RecordId,
  committedGeneration: Schema.OptionFromNullOr(RecordId),
});

export const SandboxRecoveryCheckpointRefusalReason = {
  OperationReused: 'operation_reused',
  WorkspaceChanged: 'workspace_changed',
  WorkActive: 'work_active',
  MachineUnavailable: 'machine_unavailable',
  MaintenanceActive: 'maintenance_active',
  CheckpointActive: 'checkpoint_active',
  DrainActive: 'drain_active',
} as const;

export const SandboxRecoveryCheckpointRefusal = Schema.TaggedUnion({
  RecoveryCheckpointRefused: { reason: Schema.Enum(SandboxRecoveryCheckpointRefusalReason) },
});

export const SandboxRecoveryCheckpointResult = Schema.Union([
  SandboxCheckpointResult,
  SandboxRecoveryCheckpointRefusal,
]);

export function sandboxCheckpointPath({
  workspaceId,
  mechId,
  operationId,
}: typeof SandboxCheckpointIdentity.Type): string {
  return `${sandboxWorkspacePath({ workspaceId, mechId })}/checkpoints/${encodeURIComponent(operationId)}`;
}
