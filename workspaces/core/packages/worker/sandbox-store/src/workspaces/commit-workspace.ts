import type { SqlCall } from '@mechane/store';
import { Option, Schema } from 'effect';
import { WorkspaceSnapshot } from './schemas.ts';

export type CommitWorkspaceInput = WorkspaceSnapshot & { readonly shouldClearRecovery: boolean };

/** Advances the durable head and queues the previous generation for deletion within the caller transaction. */
export function commitWorkspace({
  sql,
  generation,
  parent,
  archive,
  manifestSha256,
  capturedAt,
  capturedMachineId,
  capturedSequence,
  shouldClearRecovery,
}: SqlCall<CommitWorkspaceInput>): void {
  const codec = Schema.fromJsonString(WorkspaceSnapshot);

  const value = Schema.encodeSync(codec)({
    generation,
    parent,
    archive,
    manifestSha256,
    capturedAt,
    capturedMachineId,
    capturedSequence,
  });

  const retired = Option.getOrNull(parent);

  const clearRecovery = Number(shouldClearRecovery);

  sql.exec(
    'UPDATE sandbox_workspace SET head = ?, checkpoint = NULL, file_checkpoint = NULL, checkpoint_error = NULL, recovery = CASE WHEN ? THEN NULL ELSE recovery END WHERE slot = 1',
    value,
    clearRecovery,
  );
  sql.exec(
    'INSERT INTO workspace_retirements (generation) SELECT ? WHERE ? IS NOT NULL ON CONFLICT (generation) DO NOTHING',
    retired,
    retired,
  );
}
