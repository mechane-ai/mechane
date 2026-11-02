import { artifactDigest } from '@mechane/program';
import { Effect } from 'effect';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import type { FileDigest, PathInput } from '../types.ts';

/** Hashes release artifacts through the same regular-file boundary used by local admission. */
export const fileDigest = Effect.fn('fileDigest')(function* ({
  path,
}: PathInput): Effect.fn.Return<FileDigest, DistributionFailed> {
  return yield* artifactDigest({ path }).pipe(
    Effect.mapError((failure) => new DistributionFailed({ step: DistributionStep.Read, reason: failure.reason })),
  );
});
