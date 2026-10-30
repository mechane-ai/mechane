import { Effect } from 'effect';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DistributionStep, MODULE_NOTICE_NAMES, MODULE_SOURCE_NAMES, SOURCE_FOLDER } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import type { ModuleSourceFile } from './types.ts';

type SourceFilesInput = { readonly isPreview: boolean };
const MODULE_URL: Readonly<URL> = new URL('../../../../../infrastructure/modules/cloudflare', import.meta.url);
const MODULE_FOLDER = fileURLToPath(MODULE_URL);

/** Refuses extra or missing source files so packaging cannot silently omit a new module input. */
export const moduleSourceFiles = Effect.fn('moduleSourceFiles')(function* ({
  isPreview,
}: SourceFilesInput): Effect.fn.Return<ReadonlyArray<ModuleSourceFile>, DistributionFailed> {
  const entries = yield* Effect.tryPromise({
    try: () => readdir(MODULE_FOLDER),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Read, reason: String(cause) }),
  });

  const isComplete = MODULE_SOURCE_NAMES.every((name) => entries.includes(name));

  if (!isComplete || entries.length !== MODULE_SOURCE_NAMES.length) {
    return yield* new DistributionFailed({
      step: DistributionStep.Read,
      reason: 'Cloudflare module source differs from its declared file inventory',
    });
  }

  const sourceFile: (name: string) => ModuleSourceFile = (name) => ({ name, path: join(MODULE_FOLDER, name) });
  const moduleFiles = MODULE_SOURCE_NAMES.map(sourceFile);

  if (isPreview) {
    return moduleFiles;
  }

  const noticeFile: (name: string) => ModuleSourceFile = (name) => ({ name, path: join(SOURCE_FOLDER, name) });
  const notices = MODULE_NOTICE_NAMES.map(noticeFile);

  return [...moduleFiles, ...notices];
});
