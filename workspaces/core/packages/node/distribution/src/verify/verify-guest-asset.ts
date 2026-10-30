import { Effect, Option } from 'effect';
import { join } from 'node:path';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { assetName } from '../files/asset-name.ts';
import { releaseAssetUrl } from '../files/release-asset-url.ts';
import type { ArtifactReceipt, InstallationManifest } from '../schemas.ts';
import type { DistributionSettings } from '../types.ts';
import { guestImageDigest } from './guest-image-digest.ts';

type VerifyGuestInput = {
  readonly settings: DistributionSettings;
  readonly manifest: InstallationManifest;
  readonly receipt: ArtifactReceipt;
};

/** Checks that the guest archive and Linux image match the installation manifest. */
export const verifyGuestAsset = Effect.fn('verifyGuestAsset')(function* ({
  settings,
  manifest,
  receipt,
}: VerifyGuestInput): Effect.fn.Return<void, DistributionFailed> {
  const name = assetName({ kind: 'guest' });
  const path = join(settings.folder, name);
  const entry = receipt.assets.find((asset) => asset.name === name);
  const guest = Option.fromNullishOr(entry);

  if (Option.isNone(guest)) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'guest archive is missing from the release',
    });
  }

  const digest = yield* guestImageDigest({ path, settings });
  const url = releaseAssetUrl({ name });
  const isSameArchive = guest.value.sha256 === manifest.guest.sha256 && guest.value.bytes === manifest.guest.bytes;

  if (!isSameArchive || manifest.guest.url !== url || digest !== manifest.guest.digest) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'guest image differs from the installation manifest',
    });
  }
});
