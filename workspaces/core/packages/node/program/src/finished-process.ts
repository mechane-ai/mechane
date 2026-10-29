import { Effect, Option } from 'effect';
import type { Scope } from 'effect';
import { SUCCESS_STATUS } from './constants.ts';
import { ProcessFailed } from './errors.ts';
import { exitStatusText } from './exit-status-text.ts';
import { startProcess } from './start-process.ts';
import type { ProcessRun, StartProcessInput } from './types.ts';

/**
 * Runs a command to its end, as `startProcess` starts it, and fails unless it exits with success. The failure names the
 * command line and what the command wrote to standard error.
 */
export const finishedProcess = Effect.fn('finishedProcess')(function* ({
  command,
  args,
  environment,
  timeout,
}: StartProcessInput): Effect.fn.Return<ProcessRun, ProcessFailed, Scope.Scope> {
  const { exited } = yield* startProcess({ command, args, environment, timeout });
  const run = yield* exited;

  if (!Option.contains(run.status, SUCCESS_STATUS)) {
    const line = [command, ...args].join(' ');
    const status = exitStatusText({ status: run.status });

    return yield* new ProcessFailed({ command: line, reason: `it exited ${status}: ${run.stderr.trim()}` });
  }

  return run;
}, Effect.scoped);
