import { MachineId } from '@mechane/records';
import { FileCheckpointPurpose, FileCheckpointResult } from '@mechane/sandbox-store';
import { DateTime, Option, Schema } from 'effect';
import { AUTOMATIC_CHECKPOINT_RETRY } from '../constants.ts';
import { WorkspaceTransferFailed } from '../errors.ts';
import type { CheckpointStepInput } from './types.ts';

type FailedCheckpointInput = CheckpointStepInput & { readonly cause: unknown };

/** Keeps failed live files available without replacing their last committed snapshot. */
export function failCheckpoint({ store, checkpoint, cause }: FailedCheckpointInput): void {
  const { machineId, generation } = checkpoint;

  const reason = failureReason({ cause });

  if (FileCheckpointPurpose.guards.Automatic(checkpoint.purpose)) {
    const now = DateTime.nowUnsafe();
    const at = DateTime.addDuration(now, AUTOMATIC_CHECKPOINT_RETRY);
    const error = Option.some(reason);

    store.atomic({
      run: () => {
        store.retireWorkspace({ generation });
        store.scheduleAutomaticCheckpoint({ at, error });
      },
    });

    return;
  }

  const recover: () => void = () => {
    const result = FileCheckpointResult.cases.Failed.make({ reason });

    store.finishFileCheckpoint({ purpose: checkpoint.purpose, result });

    if (FileCheckpointPurpose.guards.Recovery(checkpoint.purpose)) {
      return;
    }

    if (FileCheckpointPurpose.guards.Drain(checkpoint.purpose)) {
      const identity = MachineId.make(machineId);

      store.clearMachineDrain({ machineId: identity });
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
