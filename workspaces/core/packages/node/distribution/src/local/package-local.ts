import { LOCAL_PACKAGE_FILES } from '@mechane/stack';
import type { LocalTarget } from '@mechane/stack';
import { Effect, Record } from 'effect';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { fileDigest } from '../files/file-digest.ts';
import { localArtifactName } from '../files/local-artifact-name.ts';
import { runCommand } from '../files/run-command.ts';
import { writeDocument } from '../files/write-document.ts';
import type { Artifact } from '../schemas.ts';
import type { DistributionSettings } from '../types.ts';
import { LOCAL_NOTICES } from './constants.ts';
import { downloadCelldNotices } from './download-celld-notices.ts';
import { downloadCelld } from './download-celld.ts';
import { localManifest } from './local-manifest.ts';
import type { CelldRelease } from './schemas.ts';
import { stageLocalFiles } from './stage-local-files.ts';

const LOCAL_ENTRY_URL: Readonly<URL> = new URL('../../../stack/src/local/main.ts', import.meta.url);
const LOCAL_ENTRY = fileURLToPath(LOCAL_ENTRY_URL);

type PackageLocalInput = {
  readonly target: LocalTarget;
  readonly commit: string;
  readonly release: CelldRelease;
  readonly settings: DistributionSettings;
};

/** Creates a fresh staging directory and returns the compressed archive's checksum and size. */
export const packageLocal = Effect.fn('packageLocal')(function* ({
  target,
  commit,
  release,
  settings,
}: PackageLocalInput): Effect.fn.Return<Artifact, DistributionFailed> {
  const folder = join(settings.folder, `local-${target}`);

  yield* Effect.tryPromise({
    try: () => mkdir(folder),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
  });
  yield* stageLocalFiles({ folder, target, settings });
  yield* downloadCelld({ folder, target, release, settings });
  yield* compileLocal({ folder, target, settings });
  yield* downloadCelldNotices({ folder, release, settings });

  const manifest = yield* localManifest({ folder, target, commit });
  const manifestPath = join(folder, LOCAL_PACKAGE_FILES.manifest);

  yield* writeDocument({ path: manifestPath, document: manifest });

  const name = localArtifactName({ target });
  const path = join(settings.folder, name);
  const files = [...Record.values(LOCAL_PACKAGE_FILES), ...LOCAL_NOTICES];

  yield* runCommand({ command: 'tar', args: ['-czf', path, '-C', folder, ...files], settings });

  const digest = yield* fileDigest({ path });

  return { name, ...digest };
});

type CompileLocalInput = Omit<PackageLocalInput, 'commit' | 'release'> & { readonly folder: string };

const compileLocal = Effect.fn('compileLocal')(function* ({
  folder,
  target,
  settings,
}: CompileLocalInput): Effect.fn.Return<void, DistributionFailed> {
  const outfile = join(folder, LOCAL_PACKAGE_FILES.launcher);

  yield* runCommand({
    command: 'bun',
    args: ['build', LOCAL_ENTRY, '--compile', `--target=bun-${target}`, '--outfile', outfile],
    settings,
  });
});
