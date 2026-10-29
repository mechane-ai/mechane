import type { ProcessFailed } from '@mechane/program';
import { Effect } from 'effect';
import { CLI_BINARY } from '../constants.ts';
import type { CliFailed, CliUndecoded } from '../errors.ts';
import type { CliRefusal } from '../types.ts';
import { cliRefusal } from './cli-refusal.ts';
import { finishedCli } from './finished-cli.ts';
import type { CliCommandInput } from './types.ts';

/** Runs the built CLI for a command the scenario expects it to refuse, and answers with the one error's code. */
export const refusedCli = Effect.fn('refusedCli')(function* ({
  stack,
  args,
  environment,
}: CliCommandInput): Effect.fn.Return<CliRefusal, ProcessFailed | CliFailed | CliUndecoded> {
  const run = yield* finishedCli({ stack, binary: CLI_BINARY, args, environment });

  return yield* cliRefusal({ args, run });
});
