import { runStackProgram } from '@mechane/stack';
import type { StackOptions } from '@mechane/stack';
import { join } from 'node:path';
import { CATALOG } from './catalog.ts';
import { runScenarios, writeCatalogSummary } from './run-scenarios.ts';
import { smokeSettings } from './settings.ts';

async function main(): Promise<void> {
  const settings = smokeSettings();

  const options: StackOptions = (() => {
    const shared: StackOptions = {
      mode: 'ephemeral',
      providers: { model: 'fixture', github: 'fixture' },
      sandbox: 'container',
      nodeExecutable: settings.nodeExecutable,
    };

    if (settings.artifacts === undefined) {
      const isConsoleDevelopment = settings.family === undefined || settings.family === 'console';

      return { ...shared, isSource: true, isConsoleDevelopment };
    }

    return {
      ...shared,
      isSource: false,
      serverEntry: join(settings.artifacts.directory, 'worker.js'),
      assetsDirectory: join(settings.artifacts.directory, 'console'),
      sandboxImage: settings.artifacts.guestImage,
      cli: { command: settings.artifacts.cliExecutable, args: [] },
    };
  })();

  await runStackProgram({
    options,
    run: async ({ stack }) => {
      await runScenarios({ stack, catalog: CATALOG, match: settings.match, family: settings.family });
    },
  });

  if (settings.match === undefined && settings.family === undefined) {
    writeCatalogSummary({ catalog: CATALOG });
  }
}

await main();
