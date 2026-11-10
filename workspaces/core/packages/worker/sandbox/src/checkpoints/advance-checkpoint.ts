import { FileCheckpointPurpose } from '@mechane/sandbox-store';
import { capturePromise } from '@mechane/utilities';
import { Array, DateTime, Option, Result } from 'effect';
import { WORKSPACE_TRANSFER_BATCH_DURATION, WORKSPACE_TRANSFER_BATCH_PARTS } from '../constants.ts';
import { releaseMachineWorkspace } from '../workspace/release-machine-workspace.ts';
import { advanceCheckpointStep } from './advance-checkpoint-step.ts';
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

  for (const part of parts) {
    const current = store.workspace().checkpoint;

    if (Option.isNone(current) || current.value.generation !== checkpoint.generation) {
      return;
    }

    if (current.value.part !== part) {
      return;
    }

    const input = { store, provider, workspace, checkpoint: current.value };
    const promise = advanceCheckpointStep(input);
    const advanced = await capturePromise({ promise });
    const saved = store.workspace().checkpoint;

    if (Option.isNone(saved) || saved.value.generation !== checkpoint.generation) {
      return;
    }

    if (Result.isFailure(advanced)) {
      failCheckpoint({ ...input, cause: advanced.failure });

      if (!('executionId' in checkpoint) && FileCheckpointPurpose.guards.Recovery(checkpoint.purpose)) {
        await releaseRecoveryCheckpoint(input);

        return;
      }

      await releaseMachineWorkspace({ store, provider, workspace, machineId: checkpoint.machineId });

      return;
    }

    if (saved.value.part !== current.value.part + 1) {
      return;
    }

    const now = DateTime.nowUnsafe();

    if (DateTime.isGreaterThanOrEqualTo(now, deadline)) {
      return;
    }
  }
}
