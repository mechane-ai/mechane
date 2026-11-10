import { Effect } from 'effect';
import { constants } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DistributionStep, FORMAT_VERSION } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { createParentFolder } from '../files/create-parent-folder.ts';
import { writeDocument } from '../files/write-document.ts';
import { RUNTIME_INVENTORY_FILE, RUNTIME_OUTPUT_FOLDER } from '../runtime-artifact.ts';
import type { InstallationManifest } from '../schemas.ts';
import { moduleSourceFiles } from './module-source-files.ts';

type StageModuleInput = { readonly folder: string; readonly manifest: InstallationManifest };

/** Creates a new module directory containing the exact Worker bytes and installation metadata. */
export const stageModule = Effect.fn('stageModule')(function* ({
  folder,
  manifest,
}: StageModuleInput): Effect.fn.Return<ReadonlyArray<string>, DistributionFailed> {
  yield* Effect.tryPromise({
    try: () => mkdir(folder, { recursive: false }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
  });

  const sources = yield* moduleSourceFiles({ isPreview: manifest.is_preview });

  const runtime = manifest.runtime_files.filter((file) => file.path !== RUNTIME_INVENTORY_FILE);
  const runtimeSources = runtime.map((file) => ({ name: file.path, path: join(RUNTIME_OUTPUT_FOLDER, file.path) }));
  const files = [...sources, ...runtimeSources];

  for (const file of files) {
    const destination = join(folder, file.name);

    yield* createParentFolder({ path: destination });

    yield* Effect.tryPromise({
      try: () => copyFile(file.path, destination, constants.COPYFILE_EXCL),
      catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
    });
  }

  const inventoryPath = join(folder, RUNTIME_INVENTORY_FILE);

  yield* writeDocument({
    path: inventoryPath,
    document: {
      format_version: FORMAT_VERSION,
      version: manifest.version,
      public_commit: manifest.public_commit,
      files: runtime,
    },
  });

  const path = join(folder, 'installation.json');

  yield* writeDocument({ path, document: manifest });

  return [...files.map((file) => file.name), RUNTIME_INVENTORY_FILE, 'installation.json'];
});
