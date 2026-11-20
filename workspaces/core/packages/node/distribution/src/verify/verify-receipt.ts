import { CliTarget, RELEASE, ReleaseAsset, releaseBinaryName } from '@mechane/releases';
import { Effect, Record } from 'effect';
import { arch, platform } from 'node:os';
import { join } from 'node:path';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { assetName } from '../files/asset-name.ts';
import { fileDigest } from '../files/file-digest.ts';
import { GUEST_INPUTS_NAME } from '../guest-provenance.ts';
import type { Artifact, ArtifactReceipt } from '../schemas.ts';
import type { DistributionSettings, VerificationScope } from '../types.ts';

type VerifyReceiptInput = {
  readonly receipt: ArtifactReceipt;
  readonly settings: DistributionSettings;
  readonly scope?: VerificationScope | undefined;
};

type VerifyAssetInput = { readonly folder: string; readonly asset: Artifact };

const VERIFY_ASSET_CONCURRENCY = 4;

function hostCliBinaryName(): string | null {
  const candidate = `${platform()}-${arch()}`;
  const target = Record.values(CliTarget).find((value) => value === candidate);

  if (target === undefined) {
    return null;
  }

  return releaseBinaryName({ target });
}

function requiredAssetNames(scope: VerificationScope): ReadonlySet<string> | null {
  if (scope === 'complete') {
    return null;
  }

  const names = [
    assetName({ kind: 'cloudflare' }),
    assetName({ kind: 'setup-provider' }),
    'installation.json',
    'release.json',
    GUEST_INPUTS_NAME,
    ReleaseAsset.Manifest,
    'SHA256SUMS',
  ];

  const hostCli = hostCliBinaryName();

  if (hostCli !== null) {
    names.push(hostCli);
  }

  if (scope === 'runtime') {
    names.push(assetName({ kind: 'guest' }));
  }

  return new Set(names);
}

/** Requires the full artifact inventory and verifies every asset required for the selected verification scope. */
export const verifyReceipt = Effect.fn('verifyReceipt')(function* ({
  receipt,
  settings,
  scope = 'complete',
}: VerifyReceiptInput): Effect.fn.Return<void, DistributionFailed> {
  const targets = Record.values(CliTarget);
  const binaries = targets.map((target) => releaseBinaryName({ target }));
  const moduleName = assetName({ kind: 'cloudflare' });
  const guestName = assetName({ kind: 'guest' });
  const providerSetup = assetName({ kind: 'setup-provider' });
  const metadata = ['installation.json', 'release.json', GUEST_INPUTS_NAME, ReleaseAsset.Manifest, 'SHA256SUMS'];
  const expected = [...binaries, moduleName, guestName, providerSetup, ...metadata];
  const names = receipt.assets.map((asset) => asset.name);
  const uniqueNames = new Set(names);
  const isComplete = expected.every((name) => uniqueNames.has(name));

  if (receipt.version !== RELEASE || !isComplete || names.length !== expected.length) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'release inventory differs from the required artifacts',
    });
  }

  const required = requiredAssetNames(scope);
  const assets = selectScopeAssets(receipt.assets, required);

  yield* Effect.forEach(assets, (asset) => verifyAsset({ folder: settings.folder, asset }), {
    concurrency: VERIFY_ASSET_CONCURRENCY,
  });
});

function selectScopeAssets(
  assets: ReadonlyArray<Artifact>,
  required: ReadonlySet<string> | null,
): ReadonlyArray<Artifact> {
  if (required === null) {
    return assets;
  }

  return assets.filter((asset) => required.has(asset.name));
}

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
