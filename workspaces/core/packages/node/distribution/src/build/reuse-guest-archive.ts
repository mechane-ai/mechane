import type { GuestImageInputs } from '@mechane/stack';
import { Effect, Option } from 'effect';
import { constants } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { assetName } from '../files/asset-name.ts';
import { fileDigest } from '../files/file-digest.ts';
import { readDocument } from '../files/read-document.ts';
import { GUEST_INPUTS_NAME, GuestProvenance } from '../guest-provenance.ts';
import { ArtifactQualification } from '../qualification.ts';
import { ArtifactReceipt, InstallationManifest } from '../schemas.ts';
import type { Artifact } from '../schemas.ts';
import type { DistributionSettings, GuestReuseSelection } from '../types.ts';
import { guestImageDigest } from '../verify/guest-image-digest.ts';
import { verifyQualificationEvidence } from '../verify/verify-qualification-evidence.ts';
import type { GuestImage } from './types.ts';

type ReuseGuestInput = {
  readonly settings: DistributionSettings;
  readonly selection: GuestReuseSelection;
  readonly inputs: GuestImageInputs;
};

type ReusedGuest = {
  readonly guest: GuestImage & { readonly name: string };
  readonly previous: NonNullable<GuestProvenance['reused_from']>;
};

export const reuseGuestArchive = Effect.fn('reuseGuestArchive')(function* ({
  settings,
  selection,
  inputs,
}: ReuseGuestInput): Effect.fn.Return<ReusedGuest, DistributionFailed> {
  const qualificationPath = join(selection.folder, 'qualification.json');
  const selected = yield* fileDigest({ path: qualificationPath });

  if (selected.sha256 !== selection.qualificationSha256) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'previous qualification differs from the selected digest',
    });
  }

  const qualification = yield* readDocument({ path: qualificationPath, schema: ArtifactQualification });
  const artifactsPath = join(selection.folder, qualification.artifacts.path);
  const installationPath = join(selection.folder, qualification.installation.path);
  const artifacts = yield* fileDigest({ path: artifactsPath });
  const installation = yield* fileDigest({ path: installationPath });

  const sameArtifacts =
    artifacts.sha256 === qualification.artifacts.sha256 && artifacts.bytes === qualification.artifacts.bytes;

  const sameInstallation =
    installation.sha256 === qualification.installation.sha256 &&
    installation.bytes === qualification.installation.bytes;

  if (!sameArtifacts || !sameInstallation) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'previous qualification does not bind its release records',
    });
  }

  const receipt = yield* readDocument({ path: artifactsPath, schema: ArtifactReceipt });
  const manifest = yield* readDocument({ path: installationPath, schema: InstallationManifest });

  const matchesRelease =
    receipt.version === qualification.version && receipt.public_commit === qualification.public_commit;

  const matchesManifest = manifest.version === receipt.version && manifest.public_commit === receipt.public_commit;

  if (!matchesRelease || !matchesManifest || manifest.is_preview) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'previous qualification identifies a different release',
    });
  }

  yield* verifyQualificationEvidence({ folder: selection.folder, qualification, binding: qualification });

  const provenanceAsset = Option.fromNullishOr(receipt.assets.find((asset) => asset.name === GUEST_INPUTS_NAME));
  const guestName = previousGuestName({ version: receipt.version });
  const guestAsset = Option.fromNullishOr(receipt.assets.find((asset) => asset.name === guestName));

  if (Option.isNone(provenanceAsset) || Option.isNone(guestAsset)) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'previous qualified release has no guest input record',
    });
  }

  yield* verifySelectedAsset({ folder: selection.folder, asset: provenanceAsset.value });
  yield* verifySelectedAsset({ folder: selection.folder, asset: guestAsset.value });

  const provenance = yield* readDocument({ path: join(selection.folder, GUEST_INPUTS_NAME), schema: GuestProvenance });
  const isSameInputs = JSON.stringify(provenance.inputs) === JSON.stringify(inputs);

  const sameArchive =
    provenance.guest.sha256 === guestAsset.value.sha256 && provenance.guest.bytes === guestAsset.value.bytes;

  const sameManifest =
    manifest.guest.sha256 === guestAsset.value.sha256 && manifest.guest.bytes === guestAsset.value.bytes;

  const sameImage = sameArchive && sameManifest && provenance.guest.digest === manifest.guest.digest;

  if (!isSameInputs || !sameImage) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'previous qualified guest does not match these build inputs',
    });
  }

  const source = join(selection.folder, guestAsset.value.name);
  const digest = yield* guestImageDigest({ path: source, settings });

  if (digest !== manifest.guest.digest) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'previous guest OCI manifest differs from its qualification',
    });
  }

  const name = assetName({ kind: 'guest' });
  const destination = join(settings.folder, name);

  yield* Effect.tryPromise({
    try: () => copyFile(source, destination, constants.COPYFILE_EXCL),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
  });

  const checksum = yield* fileDigest({ path: destination });

  if (checksum.sha256 !== guestAsset.value.sha256 || checksum.bytes !== guestAsset.value.bytes) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'copied guest archive differs from its qualification',
    });
  }

  return {
    guest: { name, ...checksum, digest },
    previous: Option.some({ version: receipt.version, public_commit: receipt.public_commit, sha256: selected.sha256 }),
  };
});

type SelectedAssetInput = { readonly folder: string; readonly asset: Artifact };

const verifySelectedAsset = Effect.fn('verifySelectedAsset')(function* ({
  folder,
  asset,
}: SelectedAssetInput): Effect.fn.Return<void, DistributionFailed> {
  const actual = yield* fileDigest({ path: join(folder, asset.name) });

  if (actual.sha256 !== asset.sha256 || actual.bytes !== asset.bytes) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'previous qualified guest asset changed',
    });
  }
});

type PreviousGuestNameInput = { readonly version: string };

function previousGuestName({ version }: PreviousGuestNameInput): string {
  return `mechane-guest-v${version}.oci.tar`;
}
