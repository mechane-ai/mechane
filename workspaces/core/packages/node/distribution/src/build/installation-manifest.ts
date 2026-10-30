import { Lock, MIGRATION_LOCK, WIRE_LOCK } from '@mechane/program';
import { RELEASE } from '@mechane/protocol';
import { baseConfiguration } from '@mechane/wrangler';
import { Effect, Record } from 'effect';
import { join } from 'node:path';
import { CORE_FOLDER, DistributionStep, PUBLIC_REPOSITORY } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { assetName } from '../files/asset-name.ts';
import { readDocument } from '../files/read-document.ts';
import { releaseAssetUrl } from '../files/release-asset-url.ts';
import type { InstallationManifest } from '../schemas.ts';
import { moduleManifest } from './module-manifest.ts';
import type { GuestImage } from './types.ts';
import { workerManifest } from './worker-manifest.ts';

type ManifestInput = { readonly commit: string; readonly isPreview: boolean; readonly guest: GuestImage };

/** Pins runtime bytes and compatibility metadata while excluding installation-specific origins. */
export const installationManifest = Effect.fn('installationManifest')(function* ({
  commit,
  isPreview,
  guest,
}: ManifestInput): Effect.fn.Return<InstallationManifest, DistributionFailed> {
  const base = yield* baseConfiguration({ step: DistributionStep.Read, failure: DistributionFailed });
  const worker = yield* workerManifest({ base });
  const moduleFiles = yield* moduleManifest({ isPreview });
  const defaults = Record.remove(base.vars, 'MECHANE_ORIGIN');
  const wirePath = join(CORE_FOLDER, WIRE_LOCK);
  const migrationsPath = join(CORE_FOLDER, MIGRATION_LOCK);
  const wire = yield* readDocument({ path: wirePath, schema: Lock });
  const migrations = yield* readDocument({ path: migrationsPath, schema: Lock });
  const name = assetName({ kind: 'guest' });
  const url = releaseAssetUrl({ name });

  return {
    format_version: 1,
    is_preview: isPreview,
    version: RELEASE,
    repository: PUBLIC_REPOSITORY,
    public_commit: commit,
    module_files: moduleFiles,
    worker,
    guest: { url, sha256: guest.sha256, bytes: guest.bytes, digest: guest.digest },
    defaults,
    formats: { wire, migrations },
  };
});
