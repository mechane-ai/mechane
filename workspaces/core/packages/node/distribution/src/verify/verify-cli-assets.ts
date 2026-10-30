import { CliTarget, ReleaseAsset, releaseBinaryKey, releaseBinaryName, ReleaseManifest } from '@mechane/protocol';
import { Effect, Option, Record } from 'effect';
import { join } from 'node:path';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { readDocument } from '../files/read-document.ts';
import type { ArtifactReceipt } from '../schemas.ts';
import type { DistributionSettings } from '../types.ts';

type VerifyCliInput = { readonly settings: DistributionSettings; readonly receipt: ArtifactReceipt };

type VerifyBinaryInput = {
  readonly target: CliTarget;
  readonly manifest: ReleaseManifest;
  readonly receipt: ArtifactReceipt;
};

/** Checks every supported binary against the CLI manifest and its public commit. */
export const verifyCliAssets = Effect.fn('verifyCliAssets')(function* ({
  settings,
  receipt,
}: VerifyCliInput): Effect.fn.Return<void, DistributionFailed> {
  const path = join(settings.folder, ReleaseAsset.Manifest);
  const manifest = yield* readDocument({ path, schema: ReleaseManifest });

  if (manifest.release !== receipt.version || manifest.revision !== receipt.public_commit) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'CLI manifest does not identify the public release',
    });
  }

  for (const target of Record.values(CliTarget)) {
    yield* verifyBinary({ target, manifest, receipt });
  }
});

const verifyBinary = Effect.fn('verifyBinary')(function* ({
  target,
  manifest,
  receipt,
}: VerifyBinaryInput): Effect.fn.Return<void, DistributionFailed> {
  const name = releaseBinaryName({ target });
  const binary = Option.fromNullishOr(manifest.binaries[target]);
  const entry = receipt.assets.find((candidate) => candidate.name === name);
  const asset = Option.fromNullishOr(entry);
  const path = releaseBinaryKey({ release: receipt.version, target });

  if (Option.isNone(binary) || Option.isNone(asset)) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'CLI binary is missing from its release manifest',
    });
  }

  if (
    binary.value.path !== path ||
    binary.value.sha256 !== asset.value.sha256 ||
    binary.value.bytes !== asset.value.bytes
  ) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'CLI binary differs from its release manifest',
    });
  }
});
