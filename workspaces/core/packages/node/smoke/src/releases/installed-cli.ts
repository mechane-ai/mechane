import { finishedProcess } from '@mechane/program';
import type { Stack } from '@mechane/stack';
import type { ScenarioFailure } from '@mechane/testing';
import { Effect } from 'effect';
import { join } from 'node:path';
import { ScenarioFolder } from './constants.ts';
import { installProcess } from './install-process.ts';
import type { HostRelease } from './types.ts';

/** The name of the binary install.sh installs. */
const INSTALLED_NAME = 'mechane';

type InstalledCliInput = { readonly stack: Stack; readonly folder: string; readonly release: HostRelease };

/** Publishes a release and installs it into the scenario's folder with the install script; answers with its binary. */
export const installedCli = Effect.fn('installedCli')(function* ({
  stack,
  folder,
  release,
}: InstalledCliInput): Effect.fn.Return<string, ScenarioFailure> {
  const installFolder = join(folder, ScenarioFolder.Install);

  yield* stack.publish({ folder: release.folder });
  yield* finishedProcess(installProcess({ stack, folder: installFolder }));

  return join(installFolder, INSTALLED_NAME);
});
