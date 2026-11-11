import { Effect } from 'effect';
import { mkdir } from 'node:fs/promises';
import { CORE_FOLDER, DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { createParentFolder } from '../files/create-parent-folder.ts';
import { runCommand } from '../files/run-command.ts';
import type { ArtifactReceipt } from '../schemas.ts';
import type { DistributionInput } from '../types.ts';
import { verifyDistribution } from '../verify/verify-distribution.ts';
import { buildCliAssets } from './build-cli-assets.ts';
import { buildGuestArchive } from './build-guest-archive.ts';
import { installationManifest } from './installation-manifest.ts';
import { packageModule } from './package-module.ts';
import { packageProviderSetup } from './package-provider-setup.ts';
import { readPublicSource } from './read-public-source.ts';
import { writeReceipt } from './write-receipt.ts';

/** Candidate construction is the only phase allowed to compile application bytes. */
export const buildDistribution = Effect.fn('buildDistribution')(function* ({
  settings,
}: DistributionInput): Effect.fn.Return<ArtifactReceipt, DistributionFailed> {
  const commit = yield* readPublicSource({ settings });

  yield* createOutputFolder({ settings });

  yield* runCommand({
    command: 'mise',
    args: ['-C', CORE_FOLDER, 'run', 'build:server', ':::', 'build:guest'],
    settings,
  });

  const guest = yield* buildGuestArchive({ settings });
  const providerSetup = yield* packageProviderSetup({ settings });
  const manifest = yield* installationManifest({ commit, isPreview: false, guest });
  const moduleAssets = yield* packageModule({ settings, manifest, providerSetup });
  const cliAssets = yield* buildCliAssets({ settings, commit });
  const unchanged = yield* readPublicSource({ settings });

  if (unchanged !== commit) {
    return yield* new DistributionFailed({
      step: DistributionStep.Source,
      reason: 'public source changed during the build',
    });
  }

  const guestAsset = { name: guest.name, sha256: guest.sha256, bytes: guest.bytes };
  const assets = [guestAsset, ...moduleAssets, ...cliAssets, providerSetup];

  yield* writeReceipt({ folder: settings.folder, commit, assets });

  return yield* verifyDistribution({ settings });
});

const createOutputFolder = Effect.fn('createOutputFolder')(function* ({
  settings,
}: DistributionInput): Effect.fn.Return<void, DistributionFailed> {
  yield* createParentFolder({ path: settings.folder });

  yield* Effect.tryPromise({
    try: () => mkdir(settings.folder, { recursive: false }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
  });
});
