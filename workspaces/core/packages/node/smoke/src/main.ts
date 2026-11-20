import { runStackProgram } from '@mechane/stack';
import type { StackOptions } from '@mechane/stack';
import type { Scenario } from '@mechane/testing';
import { join } from 'node:path';
import { CATALOG } from './catalog.ts';
import { runScenarios, selectScenarios, writeCatalogSummary, writeShardSummary } from './run-scenarios.ts';
import { smokeSettings } from './settings.ts';
import { scenarioNeedsContainer, selectShardScenarios } from './shards.ts';

const UNUSED_SANDBOX_ORIGIN = 'http://127.0.0.1:1';
const UNUSED_SANDBOX_KEY = 'unused-local-sandbox-key';

async function main(): Promise<void> {
  const settings = smokeSettings();

  if (settings.isCatalogSummaryOnly) {
    writeCatalogSummary({ catalog: CATALOG });

    return;
  }

  const catalog: ReadonlyArray<Scenario> = (() => {
    if (settings.shard !== undefined) {
      return selectShardScenarios({ catalog: CATALOG, shard: settings.shard });
    }

    return selectScenarios({ catalog: CATALOG, match: settings.match, family: settings.family });
  })();

  const needsContainer = catalog.some(scenarioNeedsContainer);

  const options: StackOptions = (() => {
    const shared: StackOptions = {
      mode: 'ephemeral',
      providers: { model: 'fixture', github: 'fixture' },
      sandbox: 'container',
      nodeExecutable: settings.nodeExecutable,
    };

    const containerFree = {
      sandbox: 'configured' as const,
      environment: {
        ...settings.inherited,
        MECHANE_SANDBOX_ORIGIN: UNUSED_SANDBOX_ORIGIN,
        MECHANE_SANDBOX_SERVICE_KEY: UNUSED_SANDBOX_KEY,
      },
    };

    if (settings.artifacts === undefined) {
      const isConsoleDevelopment = catalog.some(({ family }) => family === 'console');

      if (!needsContainer) {
        return { ...shared, ...containerFree, isSource: true, isConsoleDevelopment };
      }

      return { ...shared, isSource: true, isConsoleDevelopment, reuseGuest: settings.reuseGuest };
    }

    const artifactBase = {
      ...shared,
      isSource: false,
      serverEntry: join(settings.artifacts.directory, 'worker.js'),
      assetsDirectory: join(settings.artifacts.directory, 'console'),
      cli: { command: settings.artifacts.cliExecutable, args: [] },
    };

    if (!needsContainer) {
      return { ...artifactBase, ...containerFree };
    }

    if (settings.artifacts.guestImage === undefined) {
      throw new Error('Container-backed artifact smoke scenarios require --guest-image');
    }

    return { ...artifactBase, sandboxImage: settings.artifacts.guestImage };
  })();

  await runStackProgram({
    options,
    run: async ({ stack }) => {
      await runScenarios({ stack, catalog });
    },
  });

  if (settings.shard !== undefined) {
    writeShardSummary({ shard: settings.shard, catalog });
  } else if (settings.match === undefined && settings.family === undefined) {
    writeCatalogSummary({ catalog });
  }
}

await main();
