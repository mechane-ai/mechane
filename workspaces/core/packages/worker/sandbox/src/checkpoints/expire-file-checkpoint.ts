import { FileCheckpointResult } from '@mechane/sandbox-store';
import type { FileCheckpointPurpose, SandboxStore } from '@mechane/sandbox-store';
import { DateTime, Option } from 'effect';
import { WORKSPACE_OPERATION_TIMEOUT } from '../constants.ts';

type ExpireFileCheckpointInput = {
  readonly store: SandboxStore;
  readonly purpose: FileCheckpointPurpose;
  readonly startedAt: DateTime.Utc;
  readonly now: DateTime.Utc;
};

/** All file intents retain the same operation deadline and terminal failure receipt. */
export function expireFileCheckpoint({
  store,
  purpose,
  startedAt,
  now,
}: ExpireFileCheckpointInput): Option.Option<FileCheckpointResult> {
  const expiresAt = DateTime.addDuration(startedAt, WORKSPACE_OPERATION_TIMEOUT);

  if (DateTime.isLessThan(now, expiresAt)) {
    return Option.none();
  }

  const result = FileCheckpointResult.cases.Failed.make({
    reason: 'file checkpoint exceeded its five minute deadline',
  });

  store.finishFileCheckpoint({ purpose, result });

  return Option.some(result);
}
