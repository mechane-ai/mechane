import { ExecutionProgress, SourceFencePhase } from '@mechane/sandbox-wire';
import type { SourceFenceReport } from '@mechane/sandbox-wire';
import { Option } from 'effect';
import { SourceCheckpointKind } from '../constants.ts';
import { runSourceCheckpoint } from '../run-source-checkpoint.ts';
import { sourceReport } from '../source-report.ts';
import type { SourceFinalizeInput } from '../types.ts';
import type { SourceOutcome } from './types.ts';

/** Readiness requires a committed checkpoint after activation and guest-fence release. */
export async function finalizeSource({
  store,
  provider,
  workspace,
  fence,
}: SourceFinalizeInput): Promise<SourceFenceReport> {
  const progress = await runSourceCheckpoint({
    store,
    provider,
    workspace,
    sourceId: fence.generation,
    kind: SourceCheckpointKind.Finalization,
  });

  if (ExecutionProgress.guards.Running(progress)) {
    return sourceReport({ fence });
  }

  let outcome: SourceOutcome = { phase: SourceFencePhase.Ready, reason: Option.none() };

  if (!ExecutionProgress.guards.Exited(progress) || progress.exitCode !== 0) {
    outcome = {
      phase: SourceFencePhase.Failed,
      reason: Option.some('source checkout did not reach a durable checkpoint'),
    };
  }

  const finished = { ...fence, ...outcome };

  store.saveSourceFence({ fence: finished });

  return sourceReport({ fence: finished });
}
