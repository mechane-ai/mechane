import { Effect } from 'effect';
import { join } from 'node:path';
import type { DistributionFailed } from '../errors.ts';
import { assetName } from '../files/asset-name.ts';
import { fileDigest } from '../files/file-digest.ts';
import { runCommand } from '../files/run-command.ts';
import { writeDocument } from '../files/write-document.ts';
import type { Artifact, InstallationManifest } from '../schemas.ts';
import type { DistributionSettings } from '../types.ts';
import { stageModule } from './stage-module.ts';

type PackageInput = { readonly settings: DistributionSettings; readonly manifest: InstallationManifest };

/** Packages the complete OpenTofu module and repeats its manifest as a separately verifiable release asset. */
export const packageModule = Effect.fn('packageModule')(function* ({
  settings,
  manifest,
}: PackageInput): Effect.fn.Return<ReadonlyArray<Artifact>, DistributionFailed> {
  const folder = join(settings.folder, 'module');
  const files = yield* stageModule({ folder, manifest });
  const name = assetName({ kind: 'cloudflare' });
  const path = join(settings.folder, name);

  yield* runCommand({ command: 'zip', args: ['-X', '-q', '-j', path, ...files], settings });

  const checksum = yield* fileDigest({ path });
  const manifestPath = join(settings.folder, 'installation.json');

  yield* writeDocument({ path: manifestPath, document: manifest });

  const manifestDigest = yield* fileDigest({ path: manifestPath });

  return [
    { name, ...checksum },
    { name: 'installation.json', ...manifestDigest },
  ];
});
