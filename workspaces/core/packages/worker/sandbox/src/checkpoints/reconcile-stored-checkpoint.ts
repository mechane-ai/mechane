import { Option } from 'effect';
import { commitCheckpoint } from './commit-checkpoint.ts';
import { reconcileCheckpointPart } from './reconcile-checkpoint-part.ts';
import type { CheckpointStepInput } from './types.ts';

/** Commits complete archives and reconciles stored parts before contacting the guest. */
export async function reconcileStoredCheckpoint({
  store,
  provider,
  workspace,
  checkpoint,
}: CheckpointStepInput): Promise<boolean> {
  const input = { store, provider, workspace, checkpoint };
  const archive = checkpoint.archive;

  if (Option.isNone(archive)) {
    return false;
  }

  if (checkpoint.part === archive.value.parts) {
    commitCheckpoint({ ...input, archive: archive.value });

    return true;
  }

  return await reconcileCheckpointPart({ ...input, archive: archive.value });
}
