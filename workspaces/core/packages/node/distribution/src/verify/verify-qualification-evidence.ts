import { Effect } from 'effect';
import { join } from 'node:path';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { fileDigest } from '../files/file-digest.ts';
import { readDocument } from '../files/read-document.ts';
import {
  QUALIFICATION_CHECKS,
  QualificationEvidence,
  qualificationFiles,
  qualificationInputDigest,
} from '../qualification.ts';
import type { ArtifactQualification, QualificationRequest } from '../qualification.ts';

type QualificationBinding = Pick<ArtifactQualification, 'public_commit' | 'artifacts' | 'installation'>;

type VerifyEvidenceInput = {
  readonly folder: string;
  readonly qualification: QualificationRequest;
  readonly binding: QualificationBinding;
};

export const verifyQualificationEvidence = Effect.fn('verifyQualificationEvidence')(function* ({
  folder,
  qualification,
  binding,
}: VerifyEvidenceInput): Effect.fn.Return<void, DistributionFailed> {
  const checks = qualification.checks.map((check) => check.name);
  const hasEveryCheck = QUALIFICATION_CHECKS.every((name) => checks.includes(name));

  if (!hasEveryCheck || new Set(checks).size !== checks.length) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'qualification requires complete, artifact-scenarios, and shipped-formats evidence',
    });
  }

  const files = qualificationFiles({ qualification });

  const forbidden = new Set([
    'qualification.json',
    'artifacts.json',
    'installation.json',
    'release.json',
    'SHA256SUMS',
  ]);

  for (const file of files) {
    if (forbidden.has(file.path)) {
      return yield* new DistributionFailed({
        step: DistributionStep.Verify,
        reason: 'qualification evidence overlaps release metadata',
      });
    }

    const actual = yield* fileDigest({ path: join(folder, file.path) });

    if (actual.sha256 !== file.sha256 || actual.bytes !== file.bytes) {
      return yield* new DistributionFailed({
        step: DistributionStep.Verify,
        reason: `qualification input or evidence changed: ${file.path}`,
      });
    }
  }

  const inputsDigest = qualificationInputDigest({ inputs: qualification.inputs });

  for (const check of qualification.checks) {
    const report = yield* readDocument({ path: join(folder, check.evidence.path), schema: QualificationEvidence });
    const hasMatchingIdentity = report.name === check.name && report.public_commit === binding.public_commit;

    const hasMatchingArtifacts =
      report.artifacts.sha256 === binding.artifacts.sha256 && report.artifacts.bytes === binding.artifacts.bytes;

    const hasMatchingInstallation =
      report.installation.sha256 === binding.installation.sha256 &&
      report.installation.bytes === binding.installation.bytes;

    const hasMatchingRelease = hasMatchingIdentity && hasMatchingArtifacts && hasMatchingInstallation;

    if (!hasMatchingRelease || report.inputs_sha256 !== inputsDigest) {
      return yield* new DistributionFailed({
        step: DistributionStep.Verify,
        reason: `qualification evidence belongs to different artifacts or inputs: ${check.name}`,
      });
    }
  }
});
