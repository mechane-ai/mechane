import { finish, reportExit, stepLine } from '@mechane/program';
import { Effect } from 'effect';
import { DevStatus, PROGRAM } from '../constants.ts';
import { servePackage } from './serve-package.ts';

async function main(): Promise<void> {
  const program = servePackage();
  const exit = await Effect.runPromiseExit(program);

  const status = reportExit({
    exit,
    program: PROGRAM,
    operation: 'serve the installed local runtime',
    describe: ({ failure }) => stepLine(failure),
    succeeded: () => DevStatus.Stopped,
    failed: DevStatus.Failed,
  });

  finish({ status });
}

await main();
