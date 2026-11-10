import { Effect } from 'effect';
import { join } from 'node:path';
import { DistributionStep, QUALIFICATION_FORMAT_VERSION } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { fileDigest } from '../files/file-digest.ts';
import { readDocument } from '../files/read-document.ts';
import { writeDocument } from '../files/write-document.ts';
import { QualificationRequest } from '../qualification.ts';
import type { ArtifactQualification } from '../qualification.ts';
import type { DistributionInput } from '../types.ts';
import { verifyDistribution } from '../verify/verify-distribution.ts';
import { verifyQualificationEvidence } from '../verify/verify-qualification-evidence.ts';

/** The complete gate supplies evidence; qualification never recompiles the bytes it approves. */
export const qualifyDistribution = Effect.fn('qualifyDistribution')(function* ({
  settings,
}: DistributionInput): Effect.fn.Return<ArtifactQualification, DistributionFailed> {
  if (settings.argument === undefined) {
    return yield* new DistributionFailed({
      step: DistributionStep.Settings,
      reason: 'use qualify OUTPUT REQUEST.json',
    });
  }

  const receipt = yield* verifyDistribution({ settings });
  const request = yield* readDocument({ path: settings.argument, schema: QualificationRequest });

  const artifacts = yield* fileDigest({ path: join(settings.folder, 'artifacts.json') });
  const installation = yield* fileDigest({ path: join(settings.folder, 'installation.json') });

  const qualification: ArtifactQualification = {
    format_version: QUALIFICATION_FORMAT_VERSION,
    version: receipt.version,
    public_commit: receipt.public_commit,
    artifacts: { path: 'artifacts.json', ...artifacts },
    installation: { path: 'installation.json', ...installation },
    ...request,
  };

  yield* verifyQualificationEvidence({ folder: settings.folder, qualification: request, binding: qualification });

  yield* writeDocument({ path: join(settings.folder, 'qualification.json'), document: qualification });

  return qualification;
});
