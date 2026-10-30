import { LocalTarget } from '@mechane/stack';
import { Effect } from 'effect';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { fileDigest } from '../files/file-digest.ts';
import { runCommand } from '../files/run-command.ts';
import type { DistributionSettings } from '../types.ts';
import { EXECUTABLE_MODE } from './constants.ts';
import type { CelldRelease } from './schemas.ts';

const CELLD_PLATFORMS = {
  [LocalTarget.DarwinArm64]: 'platforms.macos-arm64',
  [LocalTarget.LinuxArm64]: 'platforms.linux-arm64',
  [LocalTarget.LinuxX64]: 'platforms.linux-x64',
} as const;

type DownloadCelldInput = {
  readonly target: LocalTarget;
  readonly folder: string;
  readonly release: CelldRelease;
  readonly settings: DistributionSettings;
};

/** Refuses a downloaded runtime whose checksum differs from the toolchain lock. */
export const downloadCelld = Effect.fn('downloadCelld')(function* ({
  target,
  folder,
  release,
  settings,
}: DownloadCelldInput): Effect.fn.Return<void, DistributionFailed> {
  const platform = CELLD_PLATFORMS[target];
  const asset = release[platform];
  const archive = join(settings.folder, `celld-${target}.gz`);

  yield* runCommand({
    command: 'curl',
    args: ['--fail', '--silent', '--show-error', '--location', '--output', archive, asset.url],
    settings,
  });

  const digest = yield* fileDigest({ path: archive });
  const checksum = `sha256:${digest.sha256}`;

  if (checksum !== asset.checksum) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'downloaded celld differs from its toolchain pin',
    });
  }

  const path = join(folder, 'celld');

  yield* Effect.tryPromise({
    try: () => unpackCelld({ archive, path }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
  });
});

type UnpackCelldInput = { readonly archive: string; readonly path: string };

async function unpackCelld({ archive, path }: UnpackCelldInput): Promise<void> {
  const compressed = await readFile(archive);
  const binary = gunzipSync(compressed);

  await writeFile(path, binary, { mode: EXECUTABLE_MODE, flag: 'wx' });
}
