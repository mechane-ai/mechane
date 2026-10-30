import { releaseBinaryName } from '@mechane/protocol';
import { LOCAL_PACKAGE_FILES } from '@mechane/stack';
import type { LocalTarget } from '@mechane/stack';
import { WORKER_BUNDLE } from '@mechane/wrangler';
import { Effect } from 'effect';
import { chmod, cp } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORE_FOLDER, DistributionStep, SOURCE_FOLDER } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import { assetName } from '../files/asset-name.ts';
import { copyArtifact } from '../files/copy-artifact.ts';
import type { DistributionSettings } from '../types.ts';
import { EXECUTABLE_MODE } from './constants.ts';

const LOCAL_EXAMPLE_URL: Readonly<URL> = new URL('../../../stack/model.example.json', import.meta.url);
const LOCAL_EXAMPLE = fileURLToPath(LOCAL_EXAMPLE_URL);

type StageLocalFilesInput = {
  readonly folder: string;
  readonly target: LocalTarget;
  readonly settings: DistributionSettings;
};

/** Copies the already-built Worker, guest, and CLI bytes without rebuilding them. */
export const stageLocalFiles = Effect.fn('stageLocalFiles')(function* ({
  folder,
  target,
  settings,
}: StageLocalFilesInput): Effect.fn.Return<void, DistributionFailed> {
  const files = localSourceFiles({ target, settings });
  const cli = join(folder, LOCAL_PACKAGE_FILES.cli);

  for (const { source, name } of files) {
    const path = join(folder, name);

    yield* copyArtifact({ source, path });
  }

  yield* Effect.tryPromise({
    try: () => chmod(cli, EXECUTABLE_MODE),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
  });

  const licensesSource = join(CORE_FOLDER, 'licenses');
  const licensesPath = join(folder, 'licenses');

  yield* Effect.tryPromise({
    try: () => cp(licensesSource, licensesPath, { recursive: true }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Write, reason: String(cause) }),
  });
});

type LocalSourceFilesInput = Pick<StageLocalFilesInput, 'target' | 'settings'>;
type LocalSourceFile = { readonly source: string; readonly name: string };

function localSourceFiles({ target, settings }: LocalSourceFilesInput): ReadonlyArray<LocalSourceFile> {
  const guest = assetName({ kind: 'guest' });
  const binary = releaseBinaryName({ target });

  return [
    { source: WORKER_BUNDLE, name: LOCAL_PACKAGE_FILES.worker },
    { source: join(settings.folder, guest), name: LOCAL_PACKAGE_FILES.guest },
    { source: join(settings.folder, binary), name: LOCAL_PACKAGE_FILES.cli },
    { source: LOCAL_EXAMPLE, name: 'model.example.json' },
    { source: join(SOURCE_FOLDER, 'LICENSE'), name: 'LICENSE' },
    { source: join(SOURCE_FOLDER, 'NOTICE'), name: 'NOTICE' },
  ];
}
