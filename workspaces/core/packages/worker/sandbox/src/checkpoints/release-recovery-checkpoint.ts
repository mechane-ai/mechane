import { FileCheckpointPurpose, FileCheckpointResult } from '@mechane/sandbox-store';
import { Option } from 'effect';
import { releaseWorkspaceGeneration } from '../workspace/release-workspace.ts';
import { isCurrentCheckpoint } from './current-checkpoint.ts';
import type { CheckpointStepInput } from './types.ts';

/** A failed repair retains its old recovery row while its own scratch release is retried durably. */
export async function releaseRecoveryCheckpoint({ store, provider, checkpoint }: CheckpointStepInput): Promise<void> {
  if (!FileCheckpointPurpose.guards.Recovery(checkpoint.purpose)) {
    return;
  }

  const result = store.fileCheckpointResult({ purpose: checkpoint.purpose });

  if (Option.isNone(result) || !FileCheckpointResult.guards.Failed(result.value)) {
    return;
  }

  const guest = await provider.connect({ machineId: checkpoint.machineId });

  if (Option.isSome(guest)) {
    const lease = Option.some(checkpoint.lease);

    const isReleased = await releaseWorkspaceGeneration({
      guest: guest.value,
      machineId: checkpoint.machineId,
      generation: checkpoint.generation,
      lease,
    });

    if (!isReleased) {
      return;
    }
  }

  if (isCurrentCheckpoint({ store, checkpoint })) {
    store.retireWorkspace({ generation: checkpoint.generation });
  }
}
