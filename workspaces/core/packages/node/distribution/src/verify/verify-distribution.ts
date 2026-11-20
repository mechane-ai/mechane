import { Effect } from 'effect';
import { join } from 'node:path';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { readDocument } from '../files/read-document.ts';
import { ArtifactReceipt, InstallationManifest } from '../schemas.ts';
import type { DistributionInput, VerificationScope } from '../types.ts';
import { verifyCliAssets } from './verify-cli-assets.ts';
import { verifyGuestAsset } from './verify-guest-asset.ts';
import { verifyGuestProvenance } from './verify-guest-provenance.ts';
import { verifyModule } from './verify-module.ts';
import { verifyReceipt } from './verify-receipt.ts';
import { verifyRuntimeRelease } from './verify-runtime-release.ts';

type VerifyDistributionInput = DistributionInput & { readonly scope?: VerificationScope | undefined };

const VERIFY_STEP_CONCURRENCY = 4;

/** Verifies a release receipt, module contents, guest identity (when in scope), and CLI manifest before publication. */
export const verifyDistribution = Effect.fn('verifyDistribution')(function* ({
  settings,
  scope = 'complete',
}: VerifyDistributionInput): Effect.fn.Return<ArtifactReceipt, DistributionFailed> {
  const receiptPath = join(settings.folder, 'artifacts.json');
  const receipt = yield* readDocument({ path: receiptPath, schema: ArtifactReceipt });

  yield* verifyReceipt({ receipt, settings, scope });

  const manifestPath = join(settings.folder, 'installation.json');
  const manifest = yield* readDocument({ path: manifestPath, schema: InstallationManifest });

  if (manifest.is_preview || manifest.version !== receipt.version || manifest.public_commit !== receipt.public_commit) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'installation manifest does not identify the public release',
    });
  }

  const checks: Array<Effect.Effect<void, DistributionFailed>> = [
    verifyGuestProvenance({ settings, manifest }),
    verifyModule({ settings, manifest }),
    verifyCliAssets({ settings, receipt }),
    verifyRuntimeRelease({ settings, receipt, manifest }),
  ];

  if (scope !== 'core') {
    checks.push(verifyGuestAsset({ settings, manifest, receipt }));
  }

  yield* Effect.all(checks, { concurrency: VERIFY_STEP_CONCURRENCY });

  return receipt;
});
