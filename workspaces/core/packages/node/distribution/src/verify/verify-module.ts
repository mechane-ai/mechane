import { decodeJsonc } from '@mechane/wrangler';
import { Effect } from 'effect';
import { join } from 'node:path';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { assetName } from '../files/asset-name.ts';
import { runCommand } from '../files/run-command.ts';
import { InstallationManifest } from '../schemas.ts';
import type { DistributionSettings } from '../types.ts';
import { verifyModuleContents } from './verify-module-contents.ts';
import { verifyModuleInventory } from './verify-module-inventory.ts';

type VerifyModuleInput = { readonly settings: DistributionSettings; readonly manifest: InstallationManifest };

/** Verifies the complete module without extracting archive paths onto the filesystem. */
export const verifyModule = Effect.fn('verifyModule')(function* ({
  settings,
  manifest,
}: VerifyModuleInput): Effect.fn.Return<void, DistributionFailed> {
  const name = assetName({ kind: 'cloudflare' });
  const path = join(settings.folder, name);
  const inventory = yield* runCommand({ command: 'unzip', args: ['-Z1', path], settings });
  const entries = inventory.trimEnd().split('\n');

  yield* verifyModuleInventory({ manifest, entries });

  const text = yield* runCommand({ command: 'unzip', args: ['-p', path, 'installation.json'], settings });

  const packaged = yield* decodeJsonc({
    text,
    schema: InstallationManifest,
    options: { onExcessProperty: 'error' },
    step: DistributionStep.Verify,
    subjects: [],
    failure: DistributionFailed,
  });

  if (JSON.stringify(packaged) !== JSON.stringify(manifest)) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'module manifest differs from release metadata',
    });
  }

  yield* verifyModuleContents({ settings, manifest, path });
});
