import { FileCheckpointPurpose, FileCheckpointResult } from '@mechane/sandbox-store';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { DateTime, Option, Result } from 'effect';
import { WORKSPACE_OPERATION_TIMEOUT } from '../constants.ts';
import { WorkspaceTransferFailed } from '../errors.ts';
import { archiveCheckpoint } from './archive-checkpoint.ts';
import { commitCheckpoint } from './commit-checkpoint.ts';
import { isCurrentCheckpoint } from './current-checkpoint.ts';
import { reconcileStoredCheckpoint } from './reconcile-stored-checkpoint.ts';
import { assertRecoveryCheckpointFence } from './recovery-checkpoint-fence.ts';
import { releaseRecoveryCheckpoint } from './release-recovery-checkpoint.ts';
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

  if (!('executionId' in checkpoint) && FileCheckpointPurpose.guards.Recovery(checkpoint.purpose)) {
    const result = store.fileCheckpointResult({ purpose: checkpoint.purpose });

    if (Option.exists(result, FileCheckpointResult.guards.Failed)) {
      await releaseRecoveryCheckpoint(input);

      return;
    }

    assertRecoveryCheckpointFence({ store, purpose: checkpoint.purpose });
  }

  if (await reconcileStoredCheckpoint(input)) {
    await commitCompletedCheckpoint(input);

    return;
  }

  if (!isCurrentCheckpoint({ store, checkpoint })) {
    return;
  }

  const guest = await provider.connect({ machineId });

  if (!isCurrentCheckpoint({ store, checkpoint })) {
    return;
  }

  if (Option.isNone(guest)) {
    const now = DateTime.nowUnsafe();

    store.atomic({
      run: () => {
        if (!('executionId' in checkpoint)) {
          const result = FileCheckpointResult.cases.Failed.make({
            reason: 'machine was lost before the file checkpoint committed',
          });

          store.finishFileCheckpoint({ purpose: checkpoint.purpose, result });
        }

        store.retireWorkspace({ generation });
        store.loseMachine({ machineId, now });
      },
    });
    await provider.stop({ machineId });

    return;
  }

  assertCheckpointDeadline(input);

  if (Option.isNone(archive)) {
    return await archiveCheckpoint({ ...input, guest: guest.value });
  }

  await uploadCheckpointPart({ ...input, archive: archive.value, guest: guest.value });
  await commitCompletedCheckpoint(input);
}

async function commitCompletedCheckpoint({ store, checkpoint, ...input }: CheckpointStepInput): Promise<void> {
  const current = store.workspace().checkpoint;

  if (Option.isNone(current) || current.value.generation !== checkpoint.generation) {
    return;
  }

  const archive = current.value.archive;

  if (Option.isNone(archive) || current.value.part !== archive.value.parts) {
    return;
  }

  await commitCheckpoint({ store, ...input, checkpoint: current.value, archive: archive.value });
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
