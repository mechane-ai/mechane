import { Effect } from 'effect';
import { buildDistribution } from './build/build-distribution.ts';
import { previewModule } from './build/preview-module.ts';
import { DistributionMode } from './constants.ts';
import type { DistributionFailed } from './errors.ts';
import { loadDistributionSettings } from './load-distribution-settings.ts';
import type { DistributionResult } from './types.ts';
import { verifyDistribution } from './verify/verify-distribution.ts';

/** Selects artifact construction, verification, or an explicitly unpublishable module preview. */
export const runDistribution = Effect.fn('runDistribution')(function* (): Effect.fn.Return<
  DistributionResult,
  DistributionFailed
> {
  const settings = yield* loadDistributionSettings();

  switch (settings.mode) {
    case DistributionMode.Build:
      return yield* buildDistribution({ settings });
    case DistributionMode.Verify:
      return yield* verifyDistribution({ settings });
    case DistributionMode.Preview:
      return yield* previewModule({ settings });
  }
});
