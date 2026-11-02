import { RELEASE } from '@mechane/protocol';
import { readBuiltRelease } from '@mechane/wrangler';
import type { BuiltRelease } from '@mechane/wrangler';
import { Effect } from 'effect';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';

type DistributionDescriptorInput = { readonly commit: string; readonly isPreview: boolean };

/** A publishable package must describe the current release's built source, while a preview stays explicitly marked. */
export const distributionDescriptor = Effect.fn('distributionDescriptor')(function* ({
  commit,
  isPreview,
}: DistributionDescriptorInput): Effect.fn.Return<BuiltRelease, DistributionFailed> {
  const descriptor = yield* readBuiltRelease().pipe(
    Effect.mapError((failure) => new DistributionFailed({ step: DistributionStep.Read, reason: failure.reason })),
  );

  if (!isPreview && (descriptor.public_commit !== commit || descriptor.version !== RELEASE)) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'the Worker build belongs to another source revision or release; rebuild before publishing',
    });
  }

  return { ...descriptor, public_commit: commit };
});
