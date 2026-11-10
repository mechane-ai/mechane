import { runStackProgram } from '@mechane/stack';
import { CATALOG } from './catalog.ts';
import { runScenarios } from './run-scenarios.ts';
import { smokeSettings } from './settings.ts';

async function main(): Promise<void> {
  const settings = smokeSettings();

  await runStackProgram({
    options: { mode: 'ephemeral', useFixtures: true, sandbox: 'container', nodeExecutable: settings.nodeExecutable },
    run: async ({ stack }) => {
      await runScenarios({ stack, catalog: CATALOG, match: settings.match });
    },
  });
}

await main();
