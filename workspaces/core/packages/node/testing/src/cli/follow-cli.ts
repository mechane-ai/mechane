import { startProcess } from '@mechane/program';
import type { RunningProcess } from '@mechane/program';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { CLI_BINARY } from '../constants.ts';
import { cliProcess } from './cli-process.ts';
import type { CliCommandInput } from './types.ts';

/**
 * Starts the built CLI for a command that streams, until the scope closes, in the output mode it writes off a terminal.
 * A scenario reads its standard output while it runs.
 */
export const followCli = Effect.fn('followCli')(function* ({
  stack,
  args,
  environment,
}: CliCommandInput): Effect.fn.Return<RunningProcess, never, Scope.Scope> {
  return yield* startProcess(cliProcess({ stack, binary: CLI_BINARY, args, environment }));
});
