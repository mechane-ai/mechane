import { FileCheckpointResult } from '@mechane/sandbox-store';
import { DateTime, Option } from 'effect';
import type { ArchivedCheckpointInput } from './types.ts';

/** The receipt cannot become observable before its complete workspace generation is the committed head. */
export function commitCheckpoint({ store, checkpoint, archive }: ArchivedCheckpointInput): void {
  const { generation, parent, machineId } = checkpoint;

  const commit: () => void = () => {
    const current = store.workspace().checkpoint;

    // Cancellation can retire the command's checkpoint while its last R2 write is in flight.
    if (Option.isNone(current) || current.value.generation !== generation) {
      return;
    }

    const now = DateTime.nowUnsafe();

    if ('executionId' in checkpoint) {
      const { executionId, receipt } = checkpoint;

      store.settleExecution({ executionId, machineId, receipt, now });
    } else {
      const result = FileCheckpointResult.cases.Committed.make({ generation });

      store.finishFileCheckpoint({ purpose: checkpoint.purpose, result });
    }

    store.commitWorkspace({ generation, parent, archive });
  };

  store.atomic({ run: commit });
}
