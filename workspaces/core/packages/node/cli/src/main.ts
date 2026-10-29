import { ExitStatus, PROGRAM } from '@mechane/commands';
import { finish, reportExit } from '@mechane/program';
import { Effect } from 'effect';
import { invoke } from './invoke/invoke.ts';

/** The `mechane` command: it carries out one invocation and ends with the status its outcome calls for. */
async function main(): Promise<void> {
  const exit = await Effect.runPromiseExit(invoke());

  const status = reportExit({
    exit,
    program: PROGRAM,
    operation: 'carry out the invocation',
    // An invocation reports every expected failure itself and answers its status, so only a defect fails it.
    describe: ({ failure }) => failure,
    succeeded: ({ value }) => value,
    failed: ExitStatus.Failed,
  });

  finish({ status });
}

await main();
