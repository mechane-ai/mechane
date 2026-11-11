import { Effect, Schema } from 'effect';
import { join } from 'node:path';
import { DistributionStep, QUALIFICATION_FORMAT_VERSION } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { fileDigest } from '../files/file-digest.ts';
import { writeDocument } from '../files/write-document.ts';
import { ArtifactQualification } from '../qualification.ts';
import type { QualificationRequest } from '../qualification.ts';
import type { ArtifactReceipt } from '../schemas.ts';
import type { DistributionSettings } from '../types.ts';
import { verifyQualificationEvidence } from '../verify/verify-qualification-evidence.ts';

/** The complete gate supplies evidence; qualification never recompiles the bytes it approves. */
type QualifyInput = {
  readonly settings: DistributionSettings;
  readonly receipt: ArtifactReceipt;
  readonly request: QualificationRequest;
};

export const qualifyDistribution = Effect.fn('qualifyDistribution')(function* ({
  settings,
  receipt,
  request,
}: QualifyInput): Effect.fn.Return<ArtifactQualification, DistributionFailed> {
  const artifacts = yield* fileDigest({ path: join(settings.folder, 'artifacts.json') });
  const installation = yield* fileDigest({ path: join(settings.folder, 'installation.json') });

  const qualification = yield* Schema.decodeUnknownEffect(ArtifactQualification)({
    format_version: QUALIFICATION_FORMAT_VERSION,
    version: receipt.version,
    public_commit: receipt.public_commit,
    artifacts: { path: 'artifacts.json', ...artifacts },
    installation: { path: 'installation.json', ...installation },
    ...request,
  }).pipe(Effect.mapError((cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) })));

  yield* verifyQualificationEvidence({ folder: settings.folder, qualification: request, binding: qualification });

  yield* writeDocument({ path: join(settings.folder, 'qualification.json'), document: qualification });

  return qualification;
});
