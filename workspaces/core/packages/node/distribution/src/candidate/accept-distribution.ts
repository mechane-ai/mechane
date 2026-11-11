import { Effect } from 'effect';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { qualifyDistribution } from '../build/qualify-distribution.ts';
import { readPublicSource } from '../build/read-public-source.ts';
import { DistributionStep, SOURCE_FOLDER } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { fileDigest } from '../files/file-digest.ts';
import { readDocument } from '../files/read-document.ts';
import { runCommand } from '../files/run-command.ts';
import type { ArtifactQualification } from '../qualification.ts';
import { RuntimeRelease } from '../runtime-artifact.ts';
import { InstallationManifest } from '../schemas.ts';
import type { DistributionInput } from '../types.ts';
import { verifyDistribution } from '../verify/verify-distribution.ts';
import { verifyQualifiedDistribution } from '../verify/verify-qualified-distribution.ts';
import { runCandidateChecks } from './run-candidate-checks.ts';
import { writeAcceptanceEvidence } from './write-acceptance-evidence.ts';

/** Qualifies one immutable candidate; repeat acceptance verifies the existing seal without replaying work. */
export const acceptDistribution = Effect.fn('acceptDistribution')(function* ({
  settings,
}: DistributionInput): Effect.fn.Return<ArtifactQualification, DistributionFailed> {
  const selected = yield* fileDigest({ path: join(settings.folder, 'artifacts.json') });

  if (selected.sha256 !== settings.argument) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'acceptance requires the explicitly selected artifacts.json SHA-256',
    });
  }

  const source = yield* readPublicSource({ settings });
  const receipt = yield* verifyDistribution({ settings });

  if (receipt.public_commit !== source) {
    return yield* new DistributionFailed({
      step: DistributionStep.Source,
      reason: 'accept this candidate from its source revision',
    });
  }

  const qualificationPath = join(settings.folder, 'qualification.json');

  if (existsSync(qualificationPath)) {
    const qualification = yield* fileDigest({ path: qualificationPath });

    return yield* verifyQualifiedDistribution({ settings: { ...settings, argument: qualification.sha256 } });
  }

  const manifest = yield* readDocument({
    path: join(settings.folder, 'installation.json'),
    schema: InstallationManifest,
  });

  const release = yield* readDocument({ path: join(settings.folder, 'release.json'), schema: RuntimeRelease });

  if (release.commands.node_version !== process.versions.node) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'use the candidate pinned Node version',
    });
  }

  const checked = yield* Effect.tryPromise({
    try: () => runCandidateChecks({ settings, receipt, manifest, release }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Command, reason: String(cause) }),
  });

  yield* verifyDistribution({ settings });

  const unchanged = yield* readPublicSource({ settings });
  const artifacts = yield* fileDigest({ path: join(settings.folder, 'artifacts.json') });

  if (unchanged !== source || artifacts.sha256 !== selected.sha256 || artifacts.bytes !== selected.bytes) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'candidate or source changed during acceptance',
    });
  }

  const installation = yield* fileDigest({ path: join(settings.folder, 'installation.json') });
  const tree = yield* runCommand({ command: 'git', args: ['-C', SOURCE_FOLDER, 'rev-parse', 'HEAD^{tree}'], settings });

  const request = yield* Effect.tryPromise({
    try: () =>
      writeAcceptanceEvidence({
        folder: settings.folder,
        source,
        tree,
        artifacts,
        installation,
        workerSha256: manifest.worker.sha256,
        checked,
      }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
  });

  return yield* qualifyDistribution({ settings, receipt, request });
});
