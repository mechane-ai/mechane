import { ExecutionStatus, FileCheckpointResult } from '@mechane/sandbox-store';
import { DateTime, Option, Schema } from 'effect';
import { WorkspaceTransferFailed } from '../errors.ts';
import type { CheckpointStepInput } from './types.ts';

type FailedCheckpointInput = CheckpointStepInput & { readonly cause: unknown };

/** Keeps failed live files available without replacing their last committed snapshot. */
export function failCheckpoint({ store, checkpoint, cause }: FailedCheckpointInput): void {
  const { machineId, generation } = checkpoint;

  if ('executionId' in checkpoint) {
    const execution = store.execution({ executionId: checkpoint.executionId });

    if (Option.isNone(execution) || execution.value.status !== ExecutionStatus.Dispatched) {
      return;
    }
  }

  const reason = failureReason({ cause });

  const recover: () => void = () => {
    const now = DateTime.nowUnsafe();

    if ('executionId' in checkpoint) {
      const { executionId, receipt } = checkpoint;

      store.failPersistence({ executionId, machineId, receipt, reason, now });
    } else {
      const result = FileCheckpointResult.cases.Failed.make({ reason });

      store.finishFileCheckpoint({ purpose: checkpoint.purpose, result });
    }

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
