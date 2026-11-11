import { runDevelopment } from '@mechane/stack';
import { runDevelopmentScenario } from './scenarios.ts';

async function main(): Promise<void> {
  const exitCode = await runDevelopment({ runScenario: runDevelopmentScenario });

  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}

await main();
