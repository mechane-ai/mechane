import { FileCheckpointResult } from '@mechane/sandbox-store';
import type { FileCheckpointPurpose, SandboxStore } from '@mechane/sandbox-store';
import { DateTime, Option } from 'effect';
import { CHECKPOINT_DEADLINE_FAILURE, checkpointDeadline } from './checkpoint-deadline.ts';

type ExpireFileCheckpointInput = {
  readonly store: SandboxStore;
  readonly purpose: FileCheckpointPurpose;
  readonly startedAt: DateTime.Utc;
  readonly now: DateTime.Utc;
};

export function expireFileCheckpoint({
  store,
  purpose,
  startedAt,
  now,
}: ExpireFileCheckpointInput): Option.Option<FileCheckpointResult> {
  const expiresAt = checkpointDeadline({ purpose, startedAt });

  if (DateTime.isLessThan(now, expiresAt)) {
    return Option.none();
  }

  const result = FileCheckpointResult.cases.Failed.make({ reason: CHECKPOINT_DEADLINE_FAILURE });

  store.finishFileCheckpoint({ purpose, result });

  return Option.some(result);
}
