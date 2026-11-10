import { RELEASE_REPOSITORY, releaseAssetUrl } from '@mechane/protocol';
import { Effect, Record } from 'effect';
import { join } from 'node:path';
import { FORMAT_VERSION } from '../constants.ts';
import type { DistributionFailed } from '../errors.ts';
import { assetName } from '../files/asset-name.ts';
import { readDocument } from '../files/read-document.ts';
import { RUNTIME_OUTPUT_FOLDER, RuntimeBuild } from '../runtime-artifact.ts';
import type { InstallationManifest } from '../schemas.ts';
import { moduleManifest } from './module-manifest.ts';
import { distributionDescriptor } from './release-descriptor.ts';
import { inventoryFile, runtimeInventory } from './runtime-inventory.ts';
import type { GuestImage } from './types.ts';
import { workerManifest } from './worker-manifest.ts';

type ManifestInput = { readonly commit: string; readonly isPreview: boolean; readonly guest: GuestImage };

/** Pins runtime bytes and compatibility metadata while excluding installation-specific origins. */
export const installationManifest = Effect.fn('installationManifest')(function* ({
  commit,
  isPreview,
  guest,
}: ManifestInput): Effect.fn.Return<InstallationManifest, DistributionFailed> {
  const { configuration: base, ...descriptor } = yield* distributionDescriptor({ commit, isPreview });
  const inventory = yield* runtimeInventory({ commit, isPreview });
  const build = yield* readDocument({ path: join(RUNTIME_OUTPUT_FOLDER, 'build.json'), schema: RuntimeBuild });
  const worker = yield* workerManifest({ base, checksum: descriptor.worker, inventory, build });
  const moduleFiles = yield* moduleManifest({ isPreview });
  const defaults = Record.remove(base.vars, 'MECHANE_ORIGIN');

  const name = assetName({ kind: 'guest' });
  const url = releaseAssetUrl({ name });

  return {
    format_version: FORMAT_VERSION,
    is_preview: isPreview,
    ...descriptor,
    repository: RELEASE_REPOSITORY,
    module_files: moduleFiles,
    runtime_files: [...inventory.files, inventoryFile({ inventory })],
    worker,
    guest: { url, sha256: guest.sha256, bytes: guest.bytes, digest: guest.digest },
    defaults,
  };
});
