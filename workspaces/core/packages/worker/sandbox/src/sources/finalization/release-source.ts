import { SourceId } from '@mechane/records';
import { SourceFencePhase } from '@mechane/sandbox-wire';
import type { SourceFenceReport } from '@mechane/sandbox-wire';
import { Option, Result, Schema } from 'effect';
import { sourceReport } from '../source-report.ts';
import type { SourceFinalizeInput } from '../types.ts';
import { releaseSourceGuest } from './release-source-guest.ts';

class SourceMachineMissing extends Schema.TaggedError<SourceMachineMissing>()('SourceMachineMissing', {
  sourceId: SourceId,
}) {}

/** A lost guest or unsuccessful release closes the checkout without claiming its uncommitted files are durable. */
export async function releaseSource({
  store,
  provider,
  workspace,
  fence,
}: SourceFinalizeInput): Promise<SourceFenceReport> {
  const identified = Result.fromOption(fence.machineId, () => new SourceMachineMissing({ sourceId: fence.sourceId }));
  // Prepared and exposed fences acquire their machine identity before they can be revoked.
  const machineId = Result.getOrThrow(identified);
  const guest = await provider.connect({ machineId });

  if (Option.isNone(guest)) {
    await provider.stop({ machineId });

    const failed = {
      ...fence,
      phase: SourceFencePhase.Failed,
      reason: Option.some('source checkout lost its guest before checkpoint'),
    };

    store.saveSourceFence({ fence: failed });

    return sourceReport({ fence: failed });
  }

  const outcome = await releaseSourceGuest({ store, provider, workspace, fence, machineId, guest: guest.value });
  const next = { ...fence, ...outcome };

  store.saveSourceFence({ fence: next });

  return sourceReport({ fence: next });
}
