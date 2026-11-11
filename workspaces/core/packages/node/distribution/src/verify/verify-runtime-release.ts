import { Effect } from 'effect';
import { join, posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { archiveDocument } from '../files/archive-document.ts';
import { fileDigest } from '../files/file-digest.ts';
import { readDocument } from '../files/read-document.ts';
import { RuntimeBuild, runtimeCommands, RuntimeInventory, RuntimeRelease } from '../runtime-artifact.ts';
import type { ArtifactReceipt, InstallationManifest } from '../schemas.ts';
import type { DistributionSettings } from '../types.ts';

type VerifyRuntimeInput = {
  readonly settings: DistributionSettings;
  readonly receipt: ArtifactReceipt;
  readonly manifest: InstallationManifest;
};

export const verifyRuntimeRelease = Effect.fn('verifyRuntimeRelease')(function* ({
  settings,
  receipt,
  manifest,
}: VerifyRuntimeInput): Effect.fn.Return<void, DistributionFailed> {
  const release = yield* readDocument({ path: join(settings.folder, 'release.json'), schema: RuntimeRelease });
  const installation = yield* fileDigest({ path: join(settings.folder, release.installation.path) });
  const archive = receipt.assets.find((asset) => asset.name === release.runtime.archive);
  const providerSetup = receipt.assets.find((asset) => asset.name === release.provider_setup.name);
  const hasMatchingSource = release.public_commit === receipt.public_commit && release.version === receipt.version;
  const hasMatchingArchive = archive?.sha256 === release.runtime.sha256 && archive.bytes === release.runtime.bytes;

  const hasMatchingInstallation =
    installation.sha256 === release.installation.sha256 && installation.bytes === release.installation.bytes;

  const hasMatchingProvider =
    providerSetup?.sha256 === release.provider_setup.sha256 && providerSetup.bytes === release.provider_setup.bytes;

  const hasMatchingArtifacts = hasMatchingArchive && hasMatchingInstallation && hasMatchingProvider;

  if (!hasMatchingSource || !hasMatchingArtifacts) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'runtime descriptor differs from its release inventory',
    });
  }

  const path = join(settings.folder, release.runtime.archive);

  const inventory = yield* archiveDocument({
    path,
    entry: 'runtime.json',
    schema: RuntimeInventory,
    settings,
    format: 'zip',
  });

  const build = yield* archiveDocument({ path, entry: 'build.json', schema: RuntimeBuild, settings, format: 'zip' });
  const runtimeFiles = manifest.runtime_files.filter((file) => file.path !== 'runtime.json');

  const hasMatchingInventory =
    inventory.public_commit === receipt.public_commit &&
    inventory.version === receipt.version &&
    JSON.stringify(inventory.files) === JSON.stringify(runtimeFiles);

  const hasMatchingBuild =
    build.revision === receipt.public_commit &&
    build.version === receipt.version &&
    build.node_version === release.commands.node_version;

  const hasMatchingCommands = isDeepStrictEqual(release.commands, runtimeCommands({ nodeVersion: build.node_version }));

  const hasMatchingBuildModules =
    build.worker_modules.length === manifest.worker.modules.length &&
    build.worker_modules.every((module) =>
      manifest.worker.modules.some((entry) => entry.path === module.path && entry.content_type === module.content_type),
    );

  const hasMatchingRuntimeMetadata = hasMatchingBuild && hasMatchingBuildModules && hasMatchingCommands;

  if (!hasMatchingInventory || !hasMatchingRuntimeMetadata) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'runtime inventory or compiler provenance differs from this release',
    });
  }

  const files = new Map(manifest.runtime_files.map((file) => [file.path, file]));
  const worker = files.get(manifest.worker.path);
  const modules = manifest.worker.modules;
  const modulePaths = modules.map((module) => module.path);

  const hasMatchingModules = modules.every((module) => {
    const file = files.get(module.path);

    return file?.sha256 === module.sha256 && file.bytes === module.bytes;
  });

  const hasPrimaryModule = modules.some(
    (module) =>
      module.path === manifest.worker.path &&
      module.sha256 === manifest.worker.sha256 &&
      module.bytes === manifest.worker.bytes,
  );

  const hasMatchingWorker = worker?.sha256 === manifest.worker.sha256 && worker.bytes === manifest.worker.bytes;
  const assets = manifest.worker.assets.files;
  const assetPaths = assets.map((asset) => asset.path);

  const hasMatchingAssets = assets.every((asset) => {
    const assetPath = posix.join(manifest.worker.assets.directory, asset.path);
    const file = files.get(assetPath);

    return file?.sha256 === asset.sha256 && file.bytes === asset.bytes;
  });

  const consoleFiles = manifest.runtime_files.filter(
    (file) => file.path.split('/')[0] === manifest.worker.assets.directory,
  );

  const hasUniqueInventories =
    new Set(modulePaths).size === modulePaths.length && new Set(assetPaths).size === assetPaths.length;

  const hasCompleteAssets = assets.length === consoleFiles.length && assetPaths.includes('index.html');

  const hasValidModules = hasMatchingWorker && hasMatchingModules && hasPrimaryModule;
  const hasValidAssets = hasMatchingAssets && hasUniqueInventories && hasCompleteAssets;

  if (!hasValidModules || !hasValidAssets) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'Worker modules or Console assets differ from the runtime inventory',
    });
  }
});
