import { once } from 'node:events';
import { resetLocalState } from './reset-local-state.ts';
import { runStackProgram } from './run-stack-program.ts';
import { loadStackSettings } from './settings.ts';

async function main(): Promise<void> {
  const settings = loadStackSettings();

  if (settings.command === 'reset') {
    await resetLocalState(settings);

    process.stdout.write(`Removed inactive local state: ${settings.directory}\n`);

    return;
  }

  await runStackProgram({
    options: settings.options,
    run: async ({ stack, signal }) => {
      process.stdout.write(`MECHANE_ORIGIN=${stack.origin.origin}\nOpen ${new URL('/console', stack.origin).href}\n`);
      await once(signal, 'abort');
    },
  });
}

await main();
