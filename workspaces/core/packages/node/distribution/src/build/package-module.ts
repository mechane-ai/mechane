import { Duration, Effect } from 'effect';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { assetName } from '../files/asset-name.ts';
import { fileDigest } from '../files/file-digest.ts';
import { writeDocument } from '../files/write-document.ts';
import type { Artifact, InstallationManifest } from '../schemas.ts';
import type { DistributionSettings } from '../types.ts';
import { runtimeRelease } from './runtime-release.ts';
import { stageModule } from './stage-module.ts';

type PackageInput = { readonly settings: DistributionSettings; readonly manifest: InstallationManifest };
const ZIP_TIMEOUT = Duration.minutes(30);

/** Packages the complete OpenTofu module and repeats its manifest as a separately verifiable release asset. */
export const packageModule = Effect.fn('packageModule')(function* ({
  settings,
  manifest,
}: PackageInput): Effect.fn.Return<ReadonlyArray<Artifact>, DistributionFailed> {
  const folder = join(settings.folder, 'module');
  const files = yield* stageModule({ folder, manifest });
  const name = assetName({ kind: 'cloudflare' });
  const path = join(settings.folder, name);

  const execute = promisify(execFile);
  const timeout = Duration.toMillis(ZIP_TIMEOUT);

  yield* Effect.tryPromise({
    try: (signal) =>
      execute('zip', ['-X', '-q', path, ...files], { cwd: folder, env: settings.inherited, timeout, signal }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Command, reason: String(cause) }),
  });

  const checksum = yield* fileDigest({ path });
  const manifestPath = join(settings.folder, 'installation.json');

  yield* writeDocument({ path: manifestPath, document: manifest });

  const manifestDigest = yield* fileDigest({ path: manifestPath });
  const release = yield* runtimeRelease({ manifest, archive: { name, ...checksum }, installation: manifestDigest });
  const releasePath = join(settings.folder, 'release.json');

  yield* writeDocument({ path: releasePath, document: release });

  const releaseDigest = yield* fileDigest({ path: releasePath });

  return [
    { name, ...checksum },
    { name: 'installation.json', ...manifestDigest },
    { name: 'release.json', ...releaseDigest },
  ];
});
