import { SourceFencePhase } from '@mechane/sandbox-wire';
import type { SourceFenceReport } from '@mechane/sandbox-wire';
import { Result } from 'effect';
import { findSourceFence } from './find-source-fence.ts';
import { sourceReport } from './source-report.ts';
import type { SourceFenceInput } from './types.ts';

const REVOCABLE_PHASES: ReadonlySet<SourceFencePhase> = new Set([SourceFencePhase.Exposed, SourceFencePhase.Prepared]);

/** Only the owner of the matching prepared or exposed generation can record its credential revocation. */
export async function revokeSource({ store, sourceId, generation }: SourceFenceInput): Promise<SourceFenceReport> {
  const saved = findSourceFence({ store, sourceId, generation });

  if (Result.isFailure(saved)) {
    return saved.failure;
  }

  const fence = saved.success;

  if (fence.generation !== generation || !REVOCABLE_PHASES.has(fence.phase)) {
    return sourceReport({ fence });
  }

  const revoked = { ...fence, phase: SourceFencePhase.Revoked };

  store.saveSourceFence({ fence: revoked });

  return sourceReport({ fence: revoked });
}
