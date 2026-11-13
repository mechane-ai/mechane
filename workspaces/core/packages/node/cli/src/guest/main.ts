import { Effect } from 'effect';
import { invoke } from '../invoke/invoke.ts';
import { runMain } from '../run-main.ts';
import { guestProgramSettings } from '../settings/guest-program-settings.ts';
import type { ProgramFactory } from '../settings/program-factory.ts';

async function main(): Promise<void> {
  const program = await guestProgramSettings({ path: import.meta.filename });
  const selectProgram: ProgramFactory = () => program;
  const operation = invoke({ selectProgram });
  const exit = await Effect.runPromiseExit(operation);

  runMain({ exit });
}

await main();
