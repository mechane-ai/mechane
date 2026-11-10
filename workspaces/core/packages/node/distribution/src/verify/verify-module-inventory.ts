import { Effect } from 'effect';
import { ARTIFACT_NOTICE_NAMES, DistributionStep, MODULE_SOURCE_NAMES } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { isSafeArtifactPath, RUNTIME_REQUIRED_FILES } from '../runtime-artifact.ts';
import type { InstallationManifest } from '../schemas.ts';

type VerifyInventoryInput = { readonly manifest: InstallationManifest; readonly entries: ReadonlyArray<string> };

/** Rejects omitted, duplicated, and undeclared ZIP entries, including notices. */
export const verifyModuleInventory = Effect.fn('verifyModuleInventory')(function* ({
  manifest,
  entries,
}: VerifyInventoryInput): Effect.fn.Return<void, DistributionFailed> {
  const required = [...MODULE_SOURCE_NAMES, ...ARTIFACT_NOTICE_NAMES];
  const declared = manifest.module_files.map((file) => file.name);
  const isComplete = required.every((name) => declared.includes(name));

  if (!isComplete || declared.length !== required.length) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'module manifest differs from the required file inventory',
    });
  }

  const runtime = manifest.runtime_files.map((file) => file.path);
  const expected = [...declared, ...runtime, 'installation.json'];
  const hasEveryEntry = expected.every((name) => entries.includes(name));

  const hasSafeUniqueEntries =
    entries.every((path) => isSafeArtifactPath({ path })) && new Set(entries).size === entries.length;

  const hasEveryRuntimeFile =
    RUNTIME_REQUIRED_FILES.every((name) => runtime.includes(name)) && runtime.includes('runtime.json');

  const hasCompleteInventory = hasEveryEntry && hasSafeUniqueEntries && hasEveryRuntimeFile;

  if (!hasCompleteInventory || entries.length !== expected.length) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'module archive differs from its declared file inventory',
    });
  }
});
