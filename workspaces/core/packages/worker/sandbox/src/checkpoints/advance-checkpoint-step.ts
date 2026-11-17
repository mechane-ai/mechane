import { FileCheckpointPurpose, FileCheckpointResult } from '@mechane/sandbox-store';
import { Array, DateTime, Option, Result } from 'effect';
import { WORKSPACE_CHECKPOINT_CONCURRENT_PARTS } from '../constants.ts';
import type { GuestConnection } from '../types.ts';
import { archiveCheckpoint } from './archive-checkpoint.ts';
import { assertCheckpointDeadline } from './checkpoint-deadline.ts';
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

  if (!isCurrentCheckpoint({ store, checkpoint })) {
    return;
  }

  if (FileCheckpointPurpose.guards.Recovery(checkpoint.purpose)) {
    const result = store.fileCheckpointResult({ purpose: checkpoint.purpose });

    if (Option.exists(result, FileCheckpointResult.guards.Failed)) {
      await releaseRecoveryCheckpoint(input);

      return;
    }

    assertRecoveryCheckpointFence({ store, purpose: checkpoint.purpose });
    assertCheckpointDeadline(input);
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
