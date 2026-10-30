import { WORKER_BUNDLE } from '@mechane/wrangler';
import { Effect } from 'effect';
import { copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DistributionStep, WORKER_FILENAME } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { writeDocument } from '../files/write-document.ts';
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
  const files = [...sources, { name: WORKER_FILENAME, path: WORKER_BUNDLE }];

  for (const file of files) {
    const destination = join(folder, file.name);

    yield* Effect.tryPromise({
      try: () => copyFile(file.path, destination),
      catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
    });
  }

  const path = join(folder, 'installation.json');

  yield* writeDocument({ path, document: manifest });

  return [...files.map((file) => join(folder, file.name)), path];
});
