import { readJsonc } from '@mechane/wrangler';
import { Effect, Record } from 'effect';
import { join } from 'node:path';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import { LOCAL_PACKAGE_FILES } from './constants.ts';
import { LocalPackage } from './schemas.ts';
import { verifyPackageFile } from './verify-package-file.ts';

type ReadLocalPackageInput = { readonly folder: string };

/** Decodes the release metadata and verifies each executable or runtime asset before use. */
export const readLocalPackage = Effect.fn('readLocalPackage')(function* ({
  folder,
}: ReadLocalPackageInput): Effect.fn.Return<LocalPackage, StackFailed> {
  const path = join(folder, LOCAL_PACKAGE_FILES.manifest);

  const manifest = yield* readJsonc({
    path,
    schema: LocalPackage,
    options: { onExcessProperty: 'error' },
    step: StackStep.ReadLocalPackage,
    failure: StackFailed,
  });

  for (const [name, expected] of Record.toEntries(manifest.files)) {
    const file = join(folder, name);

    yield* verifyPackageFile({ path: file, expected });
  }

  return manifest;
});
