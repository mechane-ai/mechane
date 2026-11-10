import { FileCheckpointPurpose, FileCheckpointResult } from '@mechane/sandbox-store';
import { SandboxStopPhase } from '@mechane/sandbox-wire';
import { DateTime, Option } from 'effect';
import { publishGenerationManifest } from '../workspace/generation-manifest.ts';
import { isCurrentCheckpoint } from './current-checkpoint.ts';
import { assertRecoveryCheckpointFence } from './recovery-checkpoint-fence.ts';
import type { ArchivedCheckpointInput } from './types.ts';

/** The receipt cannot become observable before its complete workspace generation is the committed head. */
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

    // Cancellation can retire the command's checkpoint while its last R2 write is in flight.
    if (Option.isNone(current) || !isCurrentCheckpoint({ store, checkpoint })) {
      return;
    }

    const now = DateTime.nowUnsafe();

    if ('executionId' in checkpoint) {
      const { executionId, receipt } = checkpoint;

      store.settleExecution({ executionId, machineId, receipt, now });
    } else {
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

      const result = FileCheckpointResult.cases.Committed.make({ generation });

      store.finishFileCheckpoint({ purpose: checkpoint.purpose, result });
    }

    store.commitWorkspace({ generation, parent, archive, manifestSha256 });
  };

  store.atomic({ run: commit });
}
