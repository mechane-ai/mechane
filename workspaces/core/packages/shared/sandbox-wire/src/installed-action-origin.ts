import { SandboxOperationId, WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';
import { ManagedWorkerAllocation, ManagedWorkerClaim } from './managed-work.ts';

export const InstalledActionOrigin = Schema.Struct({
  ...ManagedWorkerAllocation.fields,
  workspaceId: WorkspaceId,
  workId: ManagedWorkerClaim.fields.workId,
  actionId: SandboxOperationId,
});
