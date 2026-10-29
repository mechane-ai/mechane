import { capturePromise } from '@mechane/utilities';
import { Result } from 'effect';
import { advanceCheckpointStep } from './advance-checkpoint-step.ts';
import { failCheckpoint } from './fail-checkpoint.ts';
import type { CheckpointStepInput } from './types.ts';

/** A failed save leaves the live files available for cleanup and the previously committed head intact. */
export async function advanceCheckpoint({
  store,
  provider,
  workspace,
  checkpoint,
}: CheckpointStepInput): Promise<void> {
  const input = { store, provider, workspace, checkpoint };
  const promise = advanceCheckpointStep(input);
  const advanced = await capturePromise({ promise });

  if (Result.isFailure(advanced)) {
    failCheckpoint({ ...input, cause: advanced.failure });
  }
}
