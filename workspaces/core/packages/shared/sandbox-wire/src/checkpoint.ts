import { RecordId, RecordText, SandboxOperationId } from '@mechane/records';
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

export function sandboxCheckpointPath({
  workspaceId,
  mechId,
  operationId,
}: typeof SandboxCheckpointIdentity.Type): string {
  return `${sandboxWorkspacePath({ workspaceId, mechId })}/checkpoints/${encodeURIComponent(operationId)}`;
}
