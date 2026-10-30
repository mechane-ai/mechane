import { Effect } from 'effect';
import { DistributionStep, MODULE_NOTICE_NAMES, MODULE_SOURCE_NAMES } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import type { InstallationManifest } from '../schemas.ts';

type VerifyInventoryInput = { readonly manifest: InstallationManifest; readonly entries: ReadonlyArray<string> };

/** Rejects omitted, duplicated, and undeclared ZIP entries, including notices. */
export const verifyModuleInventory = Effect.fn('verifyModuleInventory')(function* ({
  manifest,
  entries,
}: VerifyInventoryInput): Effect.fn.Return<void, DistributionFailed> {
  const required = [...MODULE_SOURCE_NAMES, ...MODULE_NOTICE_NAMES];
  const declared = manifest.module_files.map((file) => file.name);
  const isComplete = required.every((name) => declared.includes(name));

  if (!isComplete || declared.length !== required.length) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'module manifest differs from the required file inventory',
    });
  }

  const expected = [...declared, manifest.worker.path, 'installation.json'];
  const hasEveryEntry = expected.every((name) => entries.includes(name));

  if (!hasEveryEntry || entries.length !== expected.length) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'module archive differs from its declared file inventory',
    });
  }
});
