import { SOURCE_EXPIRY_MARGIN, SourceFencePhase } from '@mechane/sandbox-wire';
import type { SourceFenceReport } from '@mechane/sandbox-wire';
import { DateTime, Option } from 'effect';
import { sourceReport } from '../source-report.ts';
import type { SourceFinalizeInput } from '../types.ts';

/** An exposed credential remains fenced through its exact expiry and the clock-skew margin. */
export function expireSourceCredential({ store, fence }: SourceFinalizeInput): SourceFenceReport {
  if (Option.isNone(fence.expiresAt)) {
    return sourceReport({ fence });
  }

  const safeAt = DateTime.addDuration(fence.expiresAt.value, SOURCE_EXPIRY_MARGIN);
  const now = DateTime.nowUnsafe();

  if (DateTime.isLessThan(now, safeAt)) {
    return sourceReport({ fence });
  }

  const expired = { ...fence, phase: SourceFencePhase.Revoked };

  store.saveSourceFence({ fence: expired });

  return sourceReport({ fence: expired });
}
