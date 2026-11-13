import { MachineId, RecordId, RecordText, SandboxOperationId, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { sandboxWorkspacePath } from './service.ts';
import type { SandboxServiceIdentity } from './service.ts';

/** Restoring older saved files requires the caller's exact observed loss and committed source. */
export const SandboxRestoreRequest = wireStruct({
  fields: {
    operationId: SandboxOperationId,
    machineId: MachineId,
    recoveryGeneration: RecordId,
    committedGeneration: RecordId,
  },
});

export type SandboxRestoreRequest = typeof SandboxRestoreRequest.Type;

export const SandboxRestoreRefusalReason = {
  OperationReused: 'operation_reused',
  WorkspaceChanged: 'workspace_changed',
  MissingHead: 'missing_head',
  WorkActive: 'work_active',
  ProviderActive: 'provider_active',
  ProviderUnknown: 'provider_unknown',
  MaintenanceActive: 'maintenance_active',
  CheckpointActive: 'checkpoint_active',
} as const;

/** A restored receipt confirms verified saved files, never a fresh capture of the lost machine. */
export const SandboxRestoreResult = Schema.TaggedUnion({
  Pending: { operationId: SandboxOperationId },
  Restored: { operationId: SandboxOperationId, machineId: MachineId, generation: RecordId },
  Failed: { operationId: SandboxOperationId, reason: RecordText },
  RestoreRefused: { reason: Schema.Enum(SandboxRestoreRefusalReason) },
});

export type SandboxRestoreResult = typeof SandboxRestoreResult.Type;

export function sandboxRestorePath({ workspaceId, mechId }: SandboxServiceIdentity): string {
  const path = sandboxWorkspacePath({ workspaceId, mechId });

  return `${path}/restore`;
}
