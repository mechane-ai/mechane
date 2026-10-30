import { Effect } from 'effect';
import { join } from 'node:path';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { readDocument } from '../files/read-document.ts';
import { verifyLocalAssets } from '../local/verify-local-assets.ts';
import { ArtifactReceipt, InstallationManifest } from '../schemas.ts';
import type { DistributionInput } from '../types.ts';
import { verifyCliAssets } from './verify-cli-assets.ts';
import { verifyGuestAsset } from './verify-guest-asset.ts';
import { verifyModule } from './verify-module.ts';
import { verifyReceipt } from './verify-receipt.ts';

/** Verifies a complete release receipt, module contents, guest identity, and CLI manifest before publication. */
export const verifyDistribution = Effect.fn('verifyDistribution')(function* ({
  settings,
}: DistributionInput): Effect.fn.Return<ArtifactReceipt, DistributionFailed> {
  const receiptPath = join(settings.folder, 'artifacts.json');
  const receipt = yield* readDocument({ path: receiptPath, schema: ArtifactReceipt });

  yield* verifyReceipt({ receipt, settings });

  const manifestPath = join(settings.folder, 'installation.json');
  const manifest = yield* readDocument({ path: manifestPath, schema: InstallationManifest });

  if (manifest.is_preview || manifest.version !== receipt.version || manifest.public_commit !== receipt.public_commit) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'installation manifest does not identify the public release',
    });
  }

  yield* verifyGuestAsset({ settings, manifest, receipt });
  yield* verifyModule({ settings, manifest });
  yield* verifyCliAssets({ settings, receipt });
  yield* verifyLocalAssets({ settings, manifest, receipt });

  return receipt;
});
