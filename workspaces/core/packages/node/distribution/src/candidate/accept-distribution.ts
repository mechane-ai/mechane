import { Effect } from 'effect';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import type { ArtifactQualification } from '../qualification.ts';
import type { DistributionInput } from '../types.ts';
import {
  existingQualification,
  sealCandidateQualification,
  verifyAcceptanceCandidate,
  verifyCandidateUnchanged,
} from './candidate-context.ts';
import { runCandidateChecks } from './run-candidate-checks.ts';

/** Qualifies one immutable candidate; repeat acceptance verifies the existing seal without replaying work. */
export const acceptDistribution = Effect.fn('acceptDistribution')(function* ({
  settings,
}: DistributionInput): Effect.fn.Return<ArtifactQualification, DistributionFailed> {
  const candidate = yield* verifyAcceptanceCandidate({ settings });
  const existing = yield* existingQualification({ settings });

  if (existing !== null) {
    return existing;
  }

  const checked = yield* Effect.tryPromise({
    try: () =>
      runCandidateChecks({
        settings,
        receipt: candidate.receipt,
        manifest: candidate.manifest,
        release: candidate.release,
      }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Command, reason: String(cause) }),
  });

  const unchanged = yield* verifyCandidateUnchanged({ settings, candidate });

  return yield* sealCandidateQualification({ settings, candidate, unchanged, checked });
});
