import { Effect } from 'effect';
import { invoke } from './invoke/invoke.ts';
import { runMain } from './run-main.ts';
import type { ProgramFactory } from './settings/program-factory.ts';
import { programSettings } from './settings/program-settings.ts';

async function main(): Promise<void> {
  const selectProgram: ProgramFactory = ({ executablePath }) =>
    programSettings({ stamp: import.meta.mechaneStamp, executablePath });

  const operation = invoke({ selectProgram });
  const exit = await Effect.runPromiseExit(operation);

  runMain({ exit });
}

await main();
