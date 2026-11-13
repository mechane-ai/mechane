import { sha256Hex } from '@mechane/program';
import { Effect } from 'effect';
import { join } from 'node:path';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { readDocument } from '../files/read-document.ts';
import { GUEST_INPUTS_NAME, GuestProvenance } from '../guest-provenance.ts';
import type { InstallationManifest } from '../schemas.ts';
import type { DistributionSettings } from '../types.ts';

type VerifyGuestProvenanceInput = { readonly settings: DistributionSettings; readonly manifest: InstallationManifest };

export const verifyGuestProvenance = Effect.fn('verifyGuestProvenance')(function* ({
  settings,
  manifest,
}: VerifyGuestProvenanceInput): Effect.fn.Return<void, DistributionFailed> {
  const provenance = yield* readDocument({ path: join(settings.folder, GUEST_INPUTS_NAME), schema: GuestProvenance });
  const { inputs, guest } = provenance;

  const contents = JSON.stringify({
    format_version: inputs.format_version,
    platform: inputs.platform,
    files: inputs.files,
  });

  const digest = sha256Hex({ contents });
  const sameArchive = guest.sha256 === manifest.guest.sha256 && guest.bytes === manifest.guest.bytes;

  const sameInputs = inputs.platform === 'linux/amd64' && inputs.sha256 === digest;
  const sameImage = sameArchive && guest.digest === manifest.guest.digest;

  if (!sameInputs || !sameImage) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'guest inputs or image differ from the installation manifest',
    });
  }
});
