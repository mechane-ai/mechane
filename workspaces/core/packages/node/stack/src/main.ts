import { finish, reportExit, stepLine } from '@mechane/program';
import type { FailureLines } from '@mechane/program';
import type { ReleaseFailed } from '@mechane/release';
import { Effect, Match } from 'effect';
import { DevStatus, PROGRAM } from './constants.ts';
import { serveLocally } from './dev/serve-locally.ts';
import type { StackFailed } from './errors.ts';

/** What the failed step of the dev program could not do, and why. */
const FAILURE_LINES: Readonly<FailureLines<StackFailed | ReleaseFailed>> = {
  StackFailed: stepLine,
  ReleaseFailed: stepLine,
};

/** Runs a persistent local stack, an explicit reset, or the disposable fixture. */
async function main(): Promise<void> {
  const exit = await Effect.runPromiseExit(serveLocally());

  const status = reportExit({
    exit,
    program: PROGRAM,
    operation: 'serve the local stack',
    describe: ({ failure }) => Match.valueTags(failure, FAILURE_LINES),
    succeeded: () => DevStatus.Stopped,
    failed: DevStatus.Failed,
  });

  finish({ status });
}

await main();
