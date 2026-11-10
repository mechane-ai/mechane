import { decodeJsonc } from '@mechane/wrangler';
import { Effect } from 'effect';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { archiveEntryDigest } from '../files/archive-entry-digest.ts';
import { assetName } from '../files/asset-name.ts';
import { fileDigest } from '../files/file-digest.ts';
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

  const attributes = yield* runCommand({ command: 'unzip', args: ['-Z', '-l', path], settings });
  const permissions = attributes.split('\n').filter((line) => /^[dl-][rwxstST-]{9}\s/.test(line));

  if (permissions.length !== entries.length || permissions.some((line) => !line.startsWith('-'))) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'module archive contains a link, directory, or unsupported file entry',
    });
  }

  const text = yield* runCommand({ command: 'unzip', args: ['-p', path, 'installation.json'], settings });

  const packaged = yield* decodeJsonc({
    text,
    schema: InstallationManifest,
    options: { onExcessProperty: 'error' },
    step: DistributionStep.Verify,
    subjects: [],
    failure: DistributionFailed,
  });

  if (!isDeepStrictEqual(packaged, manifest)) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'module manifest differs from release metadata',
    });
  }

  const external = yield* fileDigest({ path: join(settings.folder, 'installation.json') });
  const embedded = yield* archiveEntryDigest({ path, entry: 'installation.json', settings, format: 'zip' });

  if (embedded.sha256 !== external.sha256 || embedded.bytes !== external.bytes) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'packaged installation manifest bytes differ from release metadata',
    });
  }

  yield* verifyModuleContents({ settings, manifest, path });
});
