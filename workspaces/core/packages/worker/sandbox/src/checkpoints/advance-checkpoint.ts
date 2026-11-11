import { FileCheckpointPurpose } from '@mechane/sandbox-store';
import { capturePromise } from '@mechane/utilities';
import { Array, DateTime, Option, Result } from 'effect';
import {
  WORKSPACE_CHECKPOINT_CONCURRENT_PARTS,
  WORKSPACE_TRANSFER_BATCH_DURATION,
  WORKSPACE_TRANSFER_BATCH_PARTS,
} from '../constants.ts';
import { releaseMachineWorkspace } from '../workspace/release-machine-workspace.ts';
import { releaseWorkspaceGeneration } from '../workspace/release-workspace.ts';
import { advanceCheckpointStep } from './advance-checkpoint-step.ts';
import { isCurrentCheckpoint } from './current-checkpoint.ts';
import { failCheckpoint } from './fail-checkpoint.ts';
import { releaseRecoveryCheckpoint } from './release-recovery-checkpoint.ts';
import type { CheckpointStepInput } from './types.ts';

/** A failed save leaves the live files available for cleanup and the previously committed head intact. */
export async function advanceCheckpoint({
  store,
  provider,
  workspace,
  checkpoint,
}: CheckpointStepInput): Promise<void> {
  const startedAt = DateTime.nowUnsafe();
  const deadline = DateTime.addDuration(startedAt, WORKSPACE_TRANSFER_BATCH_DURATION);
  const lastPart = checkpoint.part + WORKSPACE_TRANSFER_BATCH_PARTS - 1;
  const parts = Array.range(checkpoint.part, lastPart);
  const batches = Array.chunksOf(parts, WORKSPACE_CHECKPOINT_CONCURRENT_PARTS);

  for (const batch of batches) {
    const part = Array.headNonEmpty(batch);
    const current = store.workspace().checkpoint;

    if (
      Option.isNone(current) ||
      current.value.generation !== checkpoint.generation ||
      current.value.machineId !== checkpoint.machineId
    ) {
      return;
    }

    if (current.value.part !== part) {
      return;
    }

    const input = { store, provider, workspace, checkpoint: current.value };
    const promise = advanceCheckpointStep(input);
    const advanced = await capturePromise({ promise });
    const saved = store.workspace().checkpoint;

    if (
      Option.isNone(saved) ||
      saved.value.generation !== checkpoint.generation ||
      saved.value.machineId !== checkpoint.machineId
    ) {
      return;
    }

    if (Result.isFailure(advanced)) {
      if (!isCurrentCheckpoint({ store, checkpoint: current.value })) {
        return;
      }

      failCheckpoint({ ...input, cause: advanced.failure });

      if (FileCheckpointPurpose.guards.Recovery(checkpoint.purpose)) {
        await releaseRecoveryCheckpoint(input);

        return;
      }

      if (FileCheckpointPurpose.guards.Automatic(checkpoint.purpose)) {
        const guest = await provider.connect({ machineId: checkpoint.machineId });

        if (Option.isSome(guest)) {
          const lease = Option.some(checkpoint.lease);

          await releaseWorkspaceGeneration({
            guest: guest.value,
            machineId: checkpoint.machineId,
            generation: checkpoint.generation,
            lease,
          });
        }

        return;
      }

      await releaseMachineWorkspace({ store, provider, workspace, machineId: checkpoint.machineId });

      return;
    }

    if (saved.value.part !== current.value.part + batch.length) {
      return;
    }

    const now = DateTime.nowUnsafe();

    if (DateTime.isGreaterThanOrEqualTo(now, deadline)) {
      return;
    }
  }
}
