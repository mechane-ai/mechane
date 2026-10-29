import type { SandboxStore } from '@mechane/sandbox-store';
import { ExecutionProgress, SourceFencePhase } from '@mechane/sandbox-wire';
import type { SourceFenceReport } from '@mechane/sandbox-wire';
import { Option } from 'effect';
import { SourceCheckpointKind } from '../constants.ts';
import { failSource } from '../fail-source.ts';
import { runSourceCheckpoint } from '../run-source-checkpoint.ts';
import { sourceReport } from '../source-report.ts';
import type { SourceFinalizeInput } from '../types.ts';
import { expirePreparation } from './expire-preparation.ts';
import { prepareFreshSource } from './prepare-fresh-source.ts';

type SourceCheckpointInput = { readonly progress: ExecutionProgress; readonly store: SandboxStore };

/** A fresh credential guest can replace the old machine only after its workspace reaches a durable checkpoint. */
export async function requestSourcePreparation({
  store,
  provider,
  workspace,
  fence,
}: SourceFinalizeInput): Promise<SourceFenceReport> {
  if (Option.isNone(workspace)) {
    return failSource({ store, fence, reason: 'private source checkout requires portable workspace restoration' });
  }

  const current = await expirePreparation({ store, provider, workspace, fence });

  if (current.phase === SourceFencePhase.Failed) {
    return current;
  }

  const progress = await runSourceCheckpoint({
    store,
    provider,
    workspace,
    sourceId: fence.generation,
    kind: SourceCheckpointKind.Preparation,
  });

  if (ExecutionProgress.guards.Running(progress)) {
    return sourceReport({ fence });
  }

  if (!isSourceCheckpointed({ progress, store })) {
    return failSource({ store, fence, reason: 'source checkout could not checkpoint its previous workspace' });
  }

  return await prepareFreshSource({ store, provider, workspace, fence });
}

function isSourceCheckpointed({ progress, store }: SourceCheckpointInput): boolean {
  if (!ExecutionProgress.guards.Exited(progress) || progress.exitCode !== 0) {
    return false;
  }

  const workspace = store.workspace();

  return Option.isNone(workspace.recovery);
}
