import { Effect } from 'effect';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { CORE_FOLDER, DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { runCommand } from '../files/run-command.ts';
import { buildLocalAssets } from '../local/build-local-assets.ts';
import { packageProviderSetup } from '../local/package-provider-setup.ts';
import type { ArtifactReceipt } from '../schemas.ts';
import type { DistributionInput } from '../types.ts';
import { verifyDistribution } from '../verify/verify-distribution.ts';
import { buildCliAssets } from './build-cli-assets.ts';
import { buildGuestArchive } from './build-guest-archive.ts';
import { installationManifest } from './installation-manifest.ts';
import { packageModule } from './package-module.ts';
import { readPublicSource } from './read-public-source.ts';
import { writeReceipt } from './write-receipt.ts';

/** Builds and verifies a release from its clean public tag, refusing to overwrite an earlier output. */
export const buildDistribution = Effect.fn('buildDistribution')(function* ({
  settings,
}: DistributionInput): Effect.fn.Return<ArtifactReceipt, DistributionFailed> {
  const commit = yield* readPublicSource({ settings });

  yield* createOutputFolder({ settings });

  yield* runCommand({
    command: 'mise',
    args: ['-C', CORE_FOLDER, 'run', 'build:worker', ':::', 'build:guest'],
    settings,
  });

  const guest = yield* buildGuestArchive({ settings });
  const manifest = yield* installationManifest({ commit, isPreview: false, guest });
  const moduleAssets = yield* packageModule({ settings, manifest });
  const cliAssets = yield* buildCliAssets({ settings, commit });
  const localAssets = yield* buildLocalAssets({ settings, commit });
  const providerSetup = yield* packageProviderSetup({ settings });
  const unchanged = yield* readPublicSource({ settings });

  if (unchanged !== commit) {
    return yield* new DistributionFailed({
      step: DistributionStep.Source,
      reason: 'public source changed during the build',
    });
  }

  const guestAsset = { name: guest.name, sha256: guest.sha256, bytes: guest.bytes };
  const assets = [guestAsset, ...moduleAssets, ...cliAssets, ...localAssets, providerSetup];

  yield* writeReceipt({ folder: settings.folder, commit, assets });

  return yield* verifyDistribution({ settings });
});

const createOutputFolder = Effect.fn('createOutputFolder')(function* ({
  settings,
}: DistributionInput): Effect.fn.Return<void, DistributionFailed> {
  const parent = dirname(settings.folder);

  yield* Effect.tryPromise({
    try: () => mkdir(parent, { recursive: true }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
  });

  yield* Effect.tryPromise({
    try: () => mkdir(settings.folder, { recursive: false }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
  });
});
