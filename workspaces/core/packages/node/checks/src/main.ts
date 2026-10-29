import { CHECKS_PROGRAM, CheckStatus } from '@mechane/checks-kernel';
import type { ChecksFailure } from '@mechane/checks-kernel';
import { finish, reportExit } from '@mechane/program';
import type { FailureLines } from '@mechane/program';
import { Effect, Match } from 'effect';
import { reportFindings } from './report-findings.ts';
import { runChecksCommand } from './run-checks-command.ts';

/** What each failure of a run could not do, and why. */
const FAILURE_LINES: Readonly<FailureLines<ChecksFailure>> = {
  InputUnreadable: ({ path, reason }) => `read ${path}: ${reason}`,
  FileUnwritable: ({ path, reason }) => `write ${path}: ${reason}`,
};

/** Runs the command its command line names and ends with the status that command's findings call for. */
async function main(): Promise<void> {
  const exit = await Effect.runPromiseExit(runChecksCommand());

  const status = reportExit({
    exit,
    program: CHECKS_PROGRAM,
    operation: 'run the checks',
    describe: ({ failure }) => Match.valueTags(failure, FAILURE_LINES),
    succeeded: ({ value }) => reportFindings({ findings: value }),
    failed: CheckStatus.Failed,
  });

  finish({ status });
}

await main();
