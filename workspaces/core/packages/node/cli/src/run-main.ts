import { ExitStatus, PROGRAM } from '@mechane/commands';
import { finish, reportExit } from '@mechane/program';
import type { Exit } from 'effect';

type RunMainInput = { readonly exit: Exit.Exit<ExitStatus> };

export function runMain({ exit }: RunMainInput): void {
  const status = reportExit({
    exit,
    program: PROGRAM,
    operation: 'carry out the invocation',
    describe: ({ failure }) => failure,
    succeeded: ({ value }) => value,
    failed: ExitStatus.Failed,
  });

  finish({ status });
}
