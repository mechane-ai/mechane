import { DateTime } from 'effect';
import type { ArchivedCheckpointInput } from './types.ts';

/** The receipt cannot become observable before its complete workspace generation is the committed head. */
export function commitCheckpoint({ store, checkpoint, archive }: ArchivedCheckpointInput): void {
  const { generation, parent, executionId, machineId, receipt } = checkpoint;

  const commit: () => void = () => {
    const now = DateTime.nowUnsafe();

    store.settleExecution({ executionId, machineId, receipt, now });
    store.commitWorkspace({ generation, parent, archive });
  };

  store.atomic({ run: commit });
}
