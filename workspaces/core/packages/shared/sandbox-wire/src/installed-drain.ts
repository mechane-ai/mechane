import { boundedText, Bytes, BYTES_PER_KIBIBYTE, WorkspaceId } from '@mechane/records';
import { Schema } from 'effect';
import { ManagedWorkerAllocation } from './managed-work.ts';

export const SANDBOX_INSTALLED_DRAIN_PATH = '/internal/sandbox-owners/drain-installed';

const Phase = { Working: 'working', Stopping: 'stopping', Saving: 'saving', Failed: 'failed' } as const;
const REASON_MAX_BYTES = 2 * BYTES_PER_KIBIBYTE;

const PendingAllocation = Schema.Struct({
  ...ManagedWorkerAllocation.fields,
  workspaceId: WorkspaceId,
  phase: Schema.Enum(Phase),
  reason: Schema.optionalKey(boundedText({ maxBytes: Bytes.make(REASON_MAX_BYTES) })),
});

export const InstalledDrainReport = Schema.Struct({
  pending: Schema.Array(PendingAllocation),
  hasMore: Schema.Boolean,
});

export type InstalledDrainReport = typeof InstalledDrainReport.Type;
