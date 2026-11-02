import { Effect, Record } from 'effect';
import { PUBLIC_REPOSITORY } from '../constants.ts';
import type { DistributionFailed } from '../errors.ts';
import { assetName } from '../files/asset-name.ts';
import { releaseAssetUrl } from '../files/release-asset-url.ts';
import type { InstallationManifest } from '../schemas.ts';
import { moduleManifest } from './module-manifest.ts';
import { distributionDescriptor } from './release-descriptor.ts';
import type { GuestImage } from './types.ts';
import { workerManifest } from './worker-manifest.ts';

type ManifestInput = { readonly commit: string; readonly isPreview: boolean; readonly guest: GuestImage };

/** Pins runtime bytes and compatibility metadata while excluding installation-specific origins. */
export const installationManifest = Effect.fn('installationManifest')(function* ({
  commit,
  isPreview,
  guest,
}: ManifestInput): Effect.fn.Return<InstallationManifest, DistributionFailed> {
  const { configuration: base, console, ...descriptor } = yield* distributionDescriptor({ commit, isPreview });
  const worker = yield* workerManifest({ base, checksum: descriptor.worker });
  const moduleFiles = yield* moduleManifest({ isPreview });
  const defaults = Record.remove(base.vars, 'MECHANE_ORIGIN');

  const name = assetName({ kind: 'guest' });
  const url = releaseAssetUrl({ name });

  return {
    format_version: 1,
    is_preview: isPreview,
    ...descriptor,
    repository: PUBLIC_REPOSITORY,
    module_files: moduleFiles,
    worker,
    console: { path: 'console.json', ...console },
    guest: { url, sha256: guest.sha256, bytes: guest.bytes, digest: guest.digest },
    defaults,
  };
});
