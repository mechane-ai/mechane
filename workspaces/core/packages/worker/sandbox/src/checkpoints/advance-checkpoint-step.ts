import { FileCheckpointPurpose, FileCheckpointResult } from '@mechane/sandbox-store';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Array, DateTime, Option, Result } from 'effect';
import { WORKSPACE_CHECKPOINT_CONCURRENT_PARTS, WORKSPACE_OPERATION_TIMEOUT } from '../constants.ts';
import { WorkspaceTransferFailed } from '../errors.ts';
import type { GuestConnection } from '../types.ts';
import { archiveCheckpoint } from './archive-checkpoint.ts';
import { commitCheckpoint } from './commit-checkpoint.ts';
import { isCurrentCheckpoint } from './current-checkpoint.ts';
import { reconcileStoredCheckpoint } from './reconcile-stored-checkpoint.ts';
import { assertRecoveryCheckpointFence } from './recovery-checkpoint-fence.ts';
import { releaseRecoveryCheckpoint } from './release-recovery-checkpoint.ts';
import type { CheckpointStepInput } from './types.ts';
import { uploadCheckpointPart } from './upload-checkpoint-part.ts';

/** Every call advances one bounded batch. Complete stored parts can commit even after the guest disappears. */
export async function advanceCheckpointStep({
  store,
  provider,
  workspace,
  checkpoint,
}: CheckpointStepInput): Promise<void> {
  const input = { store, provider, workspace, checkpoint };
  const { archive, part } = checkpoint;

  if (FileCheckpointPurpose.guards.Recovery(checkpoint.purpose)) {
    const result = store.fileCheckpointResult({ purpose: checkpoint.purpose });

    if (Option.exists(result, FileCheckpointResult.guards.Failed)) {
      await releaseRecoveryCheckpoint(input);

      return;
    }

    assertRecoveryCheckpointFence({ store, purpose: checkpoint.purpose });
  }

  if (!isCurrentCheckpoint({ store, checkpoint })) {
    return;
  }

  if (Option.isNone(archive)) {
    const guest = await connectCheckpointGuest(input);

    if (Option.isSome(guest)) {
      await archiveCheckpoint({ ...input, guest: guest.value });
    }

    return;
  }

  const archivedInput = { ...input, archive: archive.value };

  if (part === archive.value.parts) {
    await commitCheckpoint(archivedInput);

    return;
  }

  const nextPart = Math.min(part + WORKSPACE_CHECKPOINT_CONCURRENT_PARTS, archive.value.parts);
  const parts = Array.range(part, nextPart - 1);
  const missingParts = await reconcileStoredCheckpoint({ ...archivedInput, parts });

  if (!isCurrentCheckpoint({ store, checkpoint })) {
    return;
  }

  if (missingParts.length > 0) {
    const guest = await connectCheckpointGuest(input);

    if (Option.isNone(guest)) {
      return;
    }

    const pending = missingParts.map((missingPart) =>
      uploadCheckpointPart({ ...archivedInput, guest: guest.value, part: missingPart }),
    );

    // Every started upload must settle before a failure can release the writer.
    const settled = await Promise.allSettled(pending);

    for (const result of settled) {
      if ('reason' in result) {
        const failure = Result.fail(result.reason);

        Result.getOrThrow(failure);
      }
    }
  }

  if (!isCurrentCheckpoint({ store, checkpoint })) {
    return;
  }

  const advanced = { ...checkpoint, part: nextPart };

  store.saveCheckpoint(advanced);

  if (nextPart === archive.value.parts) {
    await commitCheckpoint({ ...archivedInput, checkpoint: advanced });
  }
}

async function connectCheckpointGuest({
  store,
  provider,
  checkpoint,
}: CheckpointStepInput): Promise<Option.Option<GuestConnection>> {
  const { machineId, generation } = checkpoint;
  const guest = await provider.connect({ machineId });

  if (!isCurrentCheckpoint({ store, checkpoint })) {
    return Option.none();
  }

  if (Option.isNone(guest)) {
    const now = DateTime.nowUnsafe();

    store.atomic({
      run: () => {
        if (!FileCheckpointPurpose.guards.Automatic(checkpoint.purpose)) {
          const result = FileCheckpointResult.cases.Failed.make({
            reason: 'machine was lost before the file checkpoint committed',
          });

          store.finishFileCheckpoint({ purpose: checkpoint.purpose, result });
        }

        store.retireWorkspace({ generation });
        store.loseMachine({ machineId, now });
      },
    });

    const cacheCheckpoint = Option.none();

    await provider.stop({ machineId, checkpoint: cacheCheckpoint });

    return Option.none();
  }

  assertCheckpointDeadline({ checkpoint });

  return guest;
}

function assertCheckpointDeadline({ checkpoint }: Pick<CheckpointStepInput, 'checkpoint'>): void {
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
