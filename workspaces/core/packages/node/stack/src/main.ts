import { once } from 'node:events';
import { runStackProgram } from './run-stack-program.ts';
import { loadStackSettings } from './settings.ts';

async function main(): Promise<void> {
  const settings = loadStackSettings();

  await runStackProgram({
    options: settings,
    run: async ({ stack, signal }) => {
      process.stdout.write(`MECHANE_ORIGIN=${stack.origin.origin}\nOpen ${new URL('/console', stack.origin).href}\n`);
      await once(signal, 'abort');
    },
  });
}

await main();
