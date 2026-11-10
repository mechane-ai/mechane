import { Effect } from 'effect';
import { join } from 'node:path';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { fileDigest } from '../files/file-digest.ts';
import { readDocument } from '../files/read-document.ts';
import { ArtifactQualification } from '../qualification.ts';
import type { DistributionInput } from '../types.ts';
import { verifyDistribution } from './verify-distribution.ts';
import { verifyQualificationEvidence } from './verify-qualification-evidence.ts';

export const verifyQualifiedDistribution = Effect.fn('verifyQualifiedDistribution')(function* ({
  settings,
}: DistributionInput): Effect.fn.Return<ArtifactQualification, DistributionFailed> {
  const path = join(settings.folder, 'qualification.json');
  const digest = yield* fileDigest({ path });

  if (digest.sha256 !== settings.argument) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'qualification differs from the explicitly selected digest',
    });
  }

  const qualification = yield* readDocument({ path, schema: ArtifactQualification });
  const receipt = yield* verifyDistribution({ settings });
  const artifacts = yield* fileDigest({ path: join(settings.folder, qualification.artifacts.path) });
  const installation = yield* fileDigest({ path: join(settings.folder, qualification.installation.path) });

  const hasMatchingSource =
    qualification.public_commit === receipt.public_commit && qualification.version === receipt.version;

  const hasMatchingArtifacts =
    artifacts.sha256 === qualification.artifacts.sha256 && artifacts.bytes === qualification.artifacts.bytes;

  const hasMatchingInstallation =
    installation.sha256 === qualification.installation.sha256 &&
    installation.bytes === qualification.installation.bytes;

  if (!hasMatchingSource || !hasMatchingArtifacts || !hasMatchingInstallation) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'qualification does not identify these exact candidate bytes',
    });
  }

  yield* verifyQualificationEvidence({ folder: settings.folder, qualification, binding: qualification });

  return qualification;
});
