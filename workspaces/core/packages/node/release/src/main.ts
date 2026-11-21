import { finish, reportExit, stepLine } from '@mechane/program';
import type { FailureLines } from '@mechane/program';
import { Effect, Match } from 'effect';
import { PROGRAM, ReleaseStatus } from './constants.ts';
import type { ReleaseFailed } from './errors.ts';
import { runMode } from './run-mode.ts';

/** What the failed step of a run could not do, and why. */
const FAILURE_LINES: Readonly<FailureLines<ReleaseFailed>> = { ReleaseFailed: stepLine };

/** Builds this source's release from a clean working tree into the release folder and prints its manifest. */
async function main(): Promise<void> {
  const exit = await Effect.runPromiseExit(runMode());

  const status = reportExit({
    exit,
    program: PROGRAM,
    operation: 'run the release program',
    describe: ({ failure }) => Match.valueTags(failure, FAILURE_LINES),
    succeeded: () => ReleaseStatus.Done,
    failed: ReleaseStatus.Failed,
  });

  finish({ status });
}

await main();
