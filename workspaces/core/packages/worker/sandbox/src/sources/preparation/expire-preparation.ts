import { SourceFencePhase } from '@mechane/sandbox-wire';
import type { SourceFenceReport } from '@mechane/sandbox-wire';
import { DateTime, Option } from 'effect';
import { sourceReport } from '../source-report.ts';
import type { SourceFinalizeInput } from '../types.ts';
import { releasePreparation } from './release-preparation.ts';

/** An unexposed preparation has a fixed deadline, so an abandoned browser cannot hold the sandbox forever. */
export async function expirePreparation({ store, provider, fence }: SourceFinalizeInput): Promise<SourceFenceReport> {
  const now = DateTime.nowUnsafe();

  if (DateTime.isLessThan(now, fence.preparationDeadline)) {
    return sourceReport({ fence });
  }

  await releasePreparation({ store, provider, fence });

  const failed = {
    ...fence,
    phase: SourceFencePhase.Failed,
    reason: Option.some('source preparation expired before token delivery'),
  };

  store.saveSourceFence({ fence: failed });

  return sourceReport({ fence: failed });
}
