import { FileCheckpointPurpose } from '@mechane/sandbox-store';
import type { WorkspaceCheckpoint } from '@mechane/sandbox-store';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { DateTime, Duration, Result } from 'effect';
import { WORKSPACE_OPERATION_TIMEOUT } from '../constants.ts';
import { WorkspaceTransferFailed } from '../errors.ts';

type CheckpointStart = Pick<WorkspaceCheckpoint, 'purpose' | 'startedAt'>;
type CheckpointDeadlineInput = { readonly checkpoint: WorkspaceCheckpoint };

const RECOVERY_CHECKPOINT_TIMEOUT = Duration.minutes(15);

export const CHECKPOINT_DEADLINE_FAILURE = 'file checkpoint exceeded its deadline';

export function checkpointDeadline({ purpose, startedAt }: CheckpointStart): DateTime.Utc {
  let timeout = WORKSPACE_OPERATION_TIMEOUT;

  if (FileCheckpointPurpose.guards.Recovery(purpose)) {
    timeout = RECOVERY_CHECKPOINT_TIMEOUT;
  }

  return DateTime.addDuration(startedAt, timeout);
}

export function assertCheckpointDeadline({ checkpoint }: CheckpointDeadlineInput): void {
  const deadline = checkpointDeadline(checkpoint);
  const now = DateTime.nowUnsafe();

  if (DateTime.isLessThan(now, deadline)) {
    return;
  }

  const cause = new WorkspaceTransferFailed({
    generation: checkpoint.generation,
    step: WorkspaceStep.Archive,
    reason: CHECKPOINT_DEADLINE_FAILURE,
  });

  const failure = Result.fail(cause);

  Result.getOrThrow(failure);
}
