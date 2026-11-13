import { guestImageInputs } from '@mechane/stack';
import type { GuestImageInputs } from '@mechane/stack';
import { Effect, Option, Schema } from 'effect';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { fileDigest } from '../files/file-digest.ts';
import { writeDocument } from '../files/write-document.ts';
import { GUEST_INPUTS_NAME, GuestProvenance } from '../guest-provenance.ts';
import type { Artifact } from '../schemas.ts';
import type { DistributionInput } from '../types.ts';
import { buildGuestArchive } from './build-guest-archive.ts';
import { reuseGuestArchive } from './reuse-guest-archive.ts';
import type { GuestImage } from './types.ts';

const GUEST_DIRECTORY = fileURLToPath(new URL('../../../guest/image/', import.meta.url));
const GUEST_PLATFORM = 'linux/amd64';

type PreparedGuest = { readonly guest: GuestImage & { readonly name: string }; readonly provenance: Artifact };

type SelectedGuest = {
  readonly guest: GuestImage & { readonly name: string };
  readonly previous: GuestProvenance['reused_from'];
};

type SelectGuestInput = DistributionInput & { readonly inputs: GuestImageInputs };

export const prepareGuest = Effect.fn('prepareGuest')(function* ({
  settings,
}: DistributionInput): Effect.fn.Return<PreparedGuest, DistributionFailed> {
  const inputs = yield* readGuestInputs();
  const selected = yield* selectGuest({ settings, inputs });
  const after = yield* readGuestInputs();

  if (JSON.stringify(inputs) !== JSON.stringify(after)) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'guest image inputs changed during the build',
    });
  }

  const provenance: GuestProvenance = {
    format_version: 1,
    inputs,
    guest: { sha256: selected.guest.sha256, bytes: selected.guest.bytes, digest: selected.guest.digest },
    reused_from: selected.previous,
  };

  const document = Schema.encodeSync(GuestProvenance)(provenance);
  const path = join(settings.folder, GUEST_INPUTS_NAME);

  yield* writeDocument({ path, document });

  const checksum = yield* fileDigest({ path });

  return { guest: selected.guest, provenance: { name: GUEST_INPUTS_NAME, ...checksum } };
});

const readGuestInputs = Effect.fn('readGuestInputs')(function* (): Effect.fn.Return<
  GuestImageInputs,
  DistributionFailed
> {
  return yield* Effect.tryPromise({
    try: () => guestImageInputs({ directory: GUEST_DIRECTORY, platform: GUEST_PLATFORM }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Read, reason: String(cause) }),
  });
});

const selectGuest = Effect.fn('selectGuest')(function* ({
  settings,
  inputs,
}: SelectGuestInput): Effect.fn.Return<SelectedGuest, DistributionFailed> {
  if (Option.isSome(settings.reuseGuest)) {
    return yield* reuseGuestArchive({ settings, selection: settings.reuseGuest.value, inputs });
  }

  const guest = yield* buildGuestArchive({ settings });

  return { guest, previous: Option.none() };
});
