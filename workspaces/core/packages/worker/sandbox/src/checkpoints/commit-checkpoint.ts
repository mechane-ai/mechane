import { FileCheckpointPurpose, FileCheckpointResult } from '@mechane/sandbox-store';
import { SandboxStopPhase } from '@mechane/sandbox-wire';
import { DateTime, Option } from 'effect';
import { publishGenerationManifest } from '../workspace/generation-manifest.ts';
import { isCurrentCheckpoint } from './current-checkpoint.ts';
import { assertRecoveryCheckpointFence } from './recovery-checkpoint-fence.ts';
import type { ArchivedCheckpointInput } from './types.ts';

/** A file head becomes observable only after its complete immutable manifest is published. */
export async function commitCheckpoint({
  store,
  workspace,
  checkpoint,
  archive,
}: ArchivedCheckpointInput): Promise<void> {
  const { generation, parent, machineId } = checkpoint;

  if (!isCurrentCheckpoint({ store, checkpoint }) || checkpoint.part !== archive.parts) {
    return;
  }

  const digest = await publishGenerationManifest({ workspace, manifest: { generation, parent, archive } });
  const manifestSha256 = Option.some(digest);

  const commit: () => void = () => {
    const current = store.workspace().checkpoint;

    // Cancellation can retire this generation while its last R2 write is in flight.
    if (Option.isNone(current) || !isCurrentCheckpoint({ store, checkpoint })) {
      return;
    }

    const now = DateTime.nowUnsafe();

    if (FileCheckpointPurpose.guards.Recovery(checkpoint.purpose)) {
      assertRecoveryCheckpointFence({ store, purpose: checkpoint.purpose });

      const stop = store.latestSandboxStop();

      const hasFailedStop = Option.exists(
        stop,
        (value) => Option.contains(value.machineId, machineId) && value.phase === SandboxStopPhase.Failed,
      );

      if (hasFailedStop) {
        store.setSandboxIdleAt({ at: now });
      }
    }

    if (!FileCheckpointPurpose.guards.Automatic(checkpoint.purpose)) {
      const result = FileCheckpointResult.cases.Committed.make({ generation });

      store.finishFileCheckpoint({ purpose: checkpoint.purpose, result });
    }

    const capturedAt = Option.some(checkpoint.startedAt);
    const capturedMachineId = Option.some(machineId);
    const shouldClearRecovery = !FileCheckpointPurpose.guards.Automatic(checkpoint.purpose);

    store.commitWorkspace({
      generation,
      parent,
      archive,
      manifestSha256,
      capturedAt,
      capturedMachineId,
      capturedSequence: checkpoint.capturedSequence,
      shouldClearRecovery,
    });
  };

  store.atomic({ run: commit });
}
