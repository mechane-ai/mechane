import { FileCheckpointPurpose } from '@mechane/sandbox-store';
import { Option } from 'effect';
import { retiringWorkspace } from '../maintenance/maintenance-active.ts';
import type { CheckpointStepInput } from './types.ts';

type CurrentCheckpointInput = Pick<CheckpointStepInput, 'store' | 'checkpoint'>;

/** Transfer responses cannot restore a checkpoint that cancellation or another generation replaced. */
export function isCurrentCheckpoint({ store, checkpoint }: CurrentCheckpointInput): boolean {
  const current = store.workspace().checkpoint;

  const matches = Option.exists(current, (value) => {
    const isSameOwner = value.generation === checkpoint.generation && value.machineId === checkpoint.machineId;

    return !value.isAborting && isSameOwner && value.part === checkpoint.part;
  });

  if (!matches || !FileCheckpointPurpose.guards.Automatic(checkpoint.purpose)) {
    return matches;
  }

  return !retiringWorkspace({ store });
}
