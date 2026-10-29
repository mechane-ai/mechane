import type { SourceFence } from '@mechane/sandbox-store';
import { SourceFencePhase } from '@mechane/sandbox-wire';
import type { SourceFenceReport } from '@mechane/sandbox-wire';
import { Option, Result } from 'effect';
import type { SourceFenceInput, SourceIdentity } from './types.ts';

type FindSourceFenceInput = Pick<SourceFenceInput, 'store' | 'sourceId' | 'generation'>;

/** A missing source fence answers the same refusal before any caller can use a guest or credential. */
export function findSourceFence({
  store,
  sourceId,
  generation,
}: FindSourceFenceInput): Result.Result<SourceFence, SourceFenceReport> {
  const saved = store.sourceFence({ sourceId });

  if (Option.isNone(saved)) {
    const missing = missingSourceReport({ sourceId, generation });

    return Result.fail(missing);
  }

  return Result.succeed(saved.value);
}

function missingSourceReport({ sourceId, generation }: SourceIdentity): SourceFenceReport {
  return {
    sourceId,
    generation,
    phase: SourceFencePhase.Failed,
    expiresAt: Option.none(),
    reason: Option.some('source checkout has no fence'),
  };
}
