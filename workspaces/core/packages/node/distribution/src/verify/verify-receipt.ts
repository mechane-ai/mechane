import { CliTarget, RELEASE, ReleaseAsset, releaseBinaryName } from '@mechane/protocol';
import { LocalTarget } from '@mechane/stack';
import { Effect, Record } from 'effect';
import { join } from 'node:path';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { assetName } from '../files/asset-name.ts';
import { fileDigest } from '../files/file-digest.ts';
import { localArtifactName } from '../files/local-artifact-name.ts';
import type { Artifact, ArtifactReceipt } from '../schemas.ts';
import type { DistributionSettings } from '../types.ts';

type VerifyReceiptInput = { readonly receipt: ArtifactReceipt; readonly settings: DistributionSettings };
type VerifyAssetInput = { readonly folder: string; readonly asset: Artifact };

/** Requires the full artifact inventory and verifies every recorded size and checksum. */
export const verifyReceipt = Effect.fn('verifyReceipt')(function* ({
  receipt,
  settings,
}: VerifyReceiptInput): Effect.fn.Return<void, DistributionFailed> {
  const targets = Record.values(CliTarget);
  const binaries = targets.map((target) => releaseBinaryName({ target }));
  const moduleName = assetName({ kind: 'cloudflare' });
  const guestName = assetName({ kind: 'guest' });
  const localTargets = Record.values(LocalTarget);
  const local = localTargets.map((target) => localArtifactName({ target }));
  const providerSetup = assetName({ kind: 'setup-provider' });
  const metadata = ['installation.json', ReleaseAsset.Manifest, 'SHA256SUMS'];
  const expected = [...binaries, ...local, moduleName, guestName, providerSetup, ...metadata];
  const names = receipt.assets.map((asset) => asset.name);
  const uniqueNames = new Set(names);
  const isComplete = expected.every((name) => uniqueNames.has(name));

  if (receipt.version !== RELEASE || !isComplete || names.length !== expected.length) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'release inventory differs from the required artifacts',
    });
  }

  for (const asset of receipt.assets) {
    yield* verifyAsset({ folder: settings.folder, asset });
  }
});

const verifyAsset = Effect.fn('verifyAsset')(function* ({
  folder,
  asset,
}: VerifyAssetInput): Effect.fn.Return<void, DistributionFailed> {
  const path = join(folder, asset.name);
  const checksum = yield* fileDigest({ path });

  if (checksum.sha256 !== asset.sha256 || checksum.bytes !== asset.bytes) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'release artifact differs from its receipt',
    });
  }
});
