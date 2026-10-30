import { releaseBinaryName } from '@mechane/protocol';
import { LOCAL_PACKAGE_FILES, LocalPackage, LocalTarget } from '@mechane/stack';
import { Effect, Option, Record } from 'effect';
import { join } from 'node:path';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { archiveDocument } from '../files/archive-document.ts';
import { localArtifactName } from '../files/local-artifact-name.ts';
import type { ArtifactReceipt, InstallationManifest } from '../schemas.ts';
import type { DistributionSettings } from '../types.ts';
import { guestImageName } from './guest-image-name.ts';
import { verifyLocalInputs } from './verify-local-inputs.ts';

type VerifyLocalAssetsInput = {
  readonly settings: DistributionSettings;
  readonly manifest: InstallationManifest;
  readonly receipt: ArtifactReceipt;
};

/** Checks every platform archive against the same public Worker, guest, CLI, and source identity. */
export const verifyLocalAssets = Effect.fn('verifyLocalAssets')(function* ({
  settings,
  manifest,
  receipt,
}: VerifyLocalAssetsInput): Effect.fn.Return<void, DistributionFailed> {
  for (const target of Record.values(LocalTarget)) {
    const name = localArtifactName({ target });
    const path = join(settings.folder, name);
    const local = yield* archiveDocument({ path, entry: LOCAL_PACKAGE_FILES.manifest, schema: LocalPackage, settings });

    if (
      local.version !== manifest.version ||
      local.public_commit !== manifest.public_commit ||
      local.target !== target
    ) {
      return yield* new DistributionFailed({
        step: DistributionStep.Verify,
        reason: 'local archive does not identify the public release',
      });
    }

    yield* verifyLocalManifest({ local, manifest, receipt });
    yield* verifyLocalInputs({ path, local, settings });
  }
});

type VerifyLocalManifestInput = Omit<VerifyLocalAssetsInput, 'settings'> & { readonly local: LocalPackage };

const verifyLocalManifest = Effect.fn('verifyLocalManifest')(function* ({
  local,
  manifest,
  receipt,
}: VerifyLocalManifestInput): Effect.fn.Return<void, DistributionFailed> {
  const binaryName = releaseBinaryName({ target: local.target });
  const binary = receipt.assets.find((asset) => asset.name === binaryName);
  const cli = Option.fromNullishOr(binary);
  const image = guestImageName();
  const hasImage = local.configuration.containers.every((container) => container.image === image);

  const matches = [
    hasImage,
    local.configuration.containers.length > 0,
    local.files['worker.js'].sha256 === manifest.worker.sha256,
    local.files['guest.oci.tar'].sha256 === manifest.guest.sha256,
    Option.exists(cli, (asset) => local.files.mechane.sha256 === asset.sha256),
  ];

  if (!matches.every(Boolean)) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'local runtime inputs differ from the public artifacts',
    });
  }
});
