import type { SourceId } from '@mechane/records';
import { FileCheckpointPurpose } from '@mechane/sandbox-store';
import type { FileCheckpointResult, SourceCheckpointKind } from '@mechane/sandbox-store';
import { runFileCheckpoint } from '../checkpoints/run-file-checkpoint.ts';
import type { WorkspaceProviderStepInput } from '../types.ts';

type RunSourceCheckpointInput = WorkspaceProviderStepInput & {
  readonly sourceId: SourceId;
  readonly kind: SourceCheckpointKind;
};

/** Source preparation and finalization retain their own idempotent file-operation result. */
export async function runSourceCheckpoint({
  store,
  provider,
  workspace,
  sourceId,
  kind,
}: RunSourceCheckpointInput): Promise<FileCheckpointResult> {
  const purpose = FileCheckpointPurpose.cases.Source.make({ sourceId, stage: kind });

  return await runFileCheckpoint({ store, provider, workspace, purpose });
}
