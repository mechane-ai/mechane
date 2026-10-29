import { awaitNotice, CliOutput, startProcess } from '@mechane/program';
import type { ApprovalNotice, ProcessFailed, ProcessRun } from '@mechane/program';
import { Duration, Effect } from 'effect';
import type { Scope } from 'effect';
import { CLI_BINARY, CliStep } from '../constants.ts';
import type { CliFailed } from '../errors.ts';
import { cliProcess } from './cli-process.ts';
import { exitedFirst } from './exited-first.ts';
import type { CliCommandInput } from './types.ts';

/** How often a scenario reads the CLI's standard error for its notice while the CLI waits. */
const NOTICE_POLL_INTERVAL = Duration.millis(100);

/** A CLI that waits on a device approval: the approval its notice names, and its run once it ends. */
type StartedCli = {
  readonly approval: Effect.Effect<ApprovalNotice, CliFailed | ProcessFailed>;
  readonly finished: Effect.Effect<ProcessRun, ProcessFailed>;
};

/**
 * Starts the built CLI for a command that waits on a device approval, until the scope closes. Its `approval` waits for
 * the page and code its notice names, and fails when the CLI exits first. Its `finished` waits for the run.
 */
export const startCli = Effect.fn('startCli')(function* ({
  stack,
  args,
  environment,
}: CliCommandInput): Effect.fn.Return<StartedCli, never, Scope.Scope> {
  const running = yield* startProcess(
    cliProcess({ stack, binary: CLI_BINARY, args: [...args, ...CliOutput.Json], environment }),
  );

  const notice = awaitNotice({ stderr: running.stderr, interval: NOTICE_POLL_INTERVAL });
  const exited = exitedFirst({ running, command: args.join(' '), step: CliStep.Notice });

  return { approval: Effect.raceFirst(notice, exited), finished: running.exited };
});
