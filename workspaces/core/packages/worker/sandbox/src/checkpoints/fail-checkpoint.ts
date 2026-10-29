import { ExecutionStatus } from '@mechane/sandbox-store';
import { DateTime, Option, Schema } from 'effect';
import { WorkspaceTransferFailed } from '../errors.ts';
import type { CheckpointStepInput } from './types.ts';

type FailedCheckpointInput = CheckpointStepInput & { readonly cause: unknown };

/** Keeps failed live files available without replacing their last committed snapshot. */
export function failCheckpoint({ store, checkpoint, cause }: FailedCheckpointInput): void {
  const { executionId, machineId, generation, receipt } = checkpoint;
  const execution = store.execution({ executionId });

  if (Option.isNone(execution) || execution.value.status !== ExecutionStatus.Dispatched) {
    return;
  }

  const reason = failureReason({ cause });

  const recover: () => void = () => {
    const now = DateTime.nowUnsafe();

    store.failPersistence({ executionId, machineId, receipt, reason, now });
    store.recoverWorkspace({ generation, machineId, reason });
  };

  store.atomic({ run: recover });
}

function failureReason({ cause }: Pick<FailedCheckpointInput, 'cause'>): string {
  if (Schema.is(WorkspaceTransferFailed)(cause)) {
    return cause.reason;
  }

  return String(cause);
}
