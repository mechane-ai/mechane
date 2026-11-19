import { runDevelopment } from '@mechane/stack';

async function main(): Promise<void> {
  const exitCode = await runDevelopment({
    runScenario: async (input) => {
      const { runDevelopmentScenario } = await import('./scenarios.ts');

      await runDevelopmentScenario(input);
    },
  });

  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}

await main();
