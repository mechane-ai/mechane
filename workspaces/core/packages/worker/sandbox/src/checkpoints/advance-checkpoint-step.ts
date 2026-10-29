import { WorkspaceStep } from '@mechane/sandbox-wire';
import { DateTime, Option, Result } from 'effect';
import { WORKSPACE_OPERATION_TIMEOUT } from '../constants.ts';
import { WorkspaceTransferFailed } from '../errors.ts';
import { archiveCheckpoint } from './archive-checkpoint.ts';
import { reconcileStoredCheckpoint } from './reconcile-stored-checkpoint.ts';
import type { CheckpointStepInput } from './types.ts';
import { uploadCheckpointPart } from './upload-checkpoint-part.ts';

/** Every call advances one bounded transfer. Complete stored parts can commit even after the guest disappears. */
export async function advanceCheckpointStep({
  store,
  provider,
  workspace,
  checkpoint,
}: CheckpointStepInput): Promise<void> {
  const input = { store, provider, workspace, checkpoint };
  const { archive, machineId, generation } = checkpoint;

  if (await reconcileStoredCheckpoint(input)) {
    return;
  }

  const guest = await provider.connect({ machineId });

  if (Option.isNone(guest)) {
    store.retireWorkspace({ generation });

    const now = DateTime.nowUnsafe();

    store.loseMachine({ machineId, now });
    await provider.stop({ machineId });

    return;
  }

  assertCheckpointDeadline(input);

  if (Option.isNone(archive)) {
    return await archiveCheckpoint({ ...input, guest: guest.value });
  }

  await uploadCheckpointPart({ ...input, archive: archive.value, guest: guest.value });
}

function assertCheckpointDeadline({ checkpoint }: CheckpointStepInput): void {
  const deadline = DateTime.addDuration(checkpoint.startedAt, WORKSPACE_OPERATION_TIMEOUT);

  const now = DateTime.nowUnsafe();

  if (DateTime.isLessThan(now, deadline)) {
    return;
  }

  const cause = new WorkspaceTransferFailed({
    generation: checkpoint.generation,
    step: WorkspaceStep.Archive,
    reason: 'workspace checkpoint exceeded its five minute deadline',
  });

  const failure = Result.fail(cause);

  Result.getOrThrow(failure);
}
