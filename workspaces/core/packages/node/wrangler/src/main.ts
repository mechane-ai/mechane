import { finish, reportExit, stepLine } from '@mechane/program';
import { Effect } from 'effect';
import { writeBuiltRelease } from './built-release.ts';

async function main(): Promise<void> {
  const run = writeBuiltRelease();
  const exit = await Effect.runPromiseExit(run);

  const status = reportExit({
    exit,
    program: 'worker-build',
    operation: 'record Worker build metadata',
    describe: ({ failure }) => stepLine(failure),
    succeeded: () => 0,
    failed: 1,
  });

  finish({ status });
}

await main();
