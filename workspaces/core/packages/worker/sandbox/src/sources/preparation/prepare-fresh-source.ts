import { SourceId } from '@mechane/records';
import { SourceFencePhase, SourceGuestAnswer } from '@mechane/sandbox-wire';
import type { SourceFenceReport } from '@mechane/sandbox-wire';
import { Option, Result, Schema } from 'effect';
import { prepareFreshMachine } from '../../machines/prepare-fresh-machine.ts';
import { failSource } from '../fail-source.ts';
import { prepareSourceGuest } from '../guest/prepare-source-guest.ts';
import { sourceReport } from '../source-report.ts';
import type { SourceFinalizeInput } from '../types.ts';
import { releasePreparation } from './release-preparation.ts';

class SourceFenceMissing extends Schema.TaggedError<SourceFenceMissing>()('SourceFenceMissing', {
  sourceId: SourceId,
}) {}

/** Reads the fresh-machine journal after its asynchronous work before preparing that exact guest for credentials. */
export async function prepareFreshSource({
  store,
  provider,
  workspace,
  fence,
}: SourceFinalizeInput): Promise<SourceFenceReport> {
  const fresh = await prepareFreshMachine({ store, provider, workspace, fence });
  const saved = store.sourceFence({ sourceId: fence.sourceId });
  const currentResult = Result.fromOption(saved, () => new SourceFenceMissing({ sourceId: fence.sourceId }));
  // Preparation already saved this fence, and no operation deletes one.
  const current = Result.getOrThrow(currentResult);

  if (Option.isNone(fresh)) {
    return sourceReport({ fence: current });
  }

  const result = await prepareSourceGuest({ fence, fresh: fresh.value });

  if (SourceGuestAnswer.guards.Failed(result)) {
    await releasePreparation({ store, provider, fence: current });

    return failSource({ store, fence: current, reason: result.reason });
  }

  if (!SourceGuestAnswer.guards.Ready(result)) {
    return sourceReport({ fence: current });
  }

  const prepared = { ...current, phase: SourceFencePhase.Prepared };

  store.saveSourceFence({ fence: prepared });

  return sourceReport({ fence: prepared });
}
