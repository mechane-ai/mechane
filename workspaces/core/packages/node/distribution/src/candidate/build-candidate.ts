import { Effect } from 'effect';
import { join } from 'node:path';
import { buildDistribution } from '../build/build-distribution.ts';
import type { DistributionFailed } from '../errors.ts';
import { fileDigest } from '../files/file-digest.ts';
import type { ArtifactQualification } from '../qualification.ts';
import type { DistributionInput } from '../types.ts';
import { acceptDistribution } from './accept-distribution.ts';

/** Builds once, then accepts those exact artifacts through the canonical release gate. */
export const buildCandidate = Effect.fn('buildCandidate')(function* ({
  settings,
}: DistributionInput): Effect.fn.Return<ArtifactQualification, DistributionFailed> {
  yield* buildDistribution({ settings });

  const artifacts = yield* fileDigest({ path: join(settings.folder, 'artifacts.json') });

  return yield* acceptDistribution({ settings: { ...settings, argument: artifacts.sha256 } });
});
