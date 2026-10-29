import { SUCCESS_STATUS } from '@mechane/program';
import type { ProcessFailed } from '@mechane/program';
import { Effect } from 'effect';
import type { Schema } from 'effect';
import { CLI_BINARY } from '../constants.ts';
import type { CliFailed, CliUndecoded } from '../errors.ts';
import type { CliRun } from '../types.ts';
import { cliResult } from './cli-result.ts';
import { finishedCli } from './finished-cli.ts';
import type { CliCommandInput } from './types.ts';

/** A CLI command to run, and the schema that decodes its result. */
type RunCliInput<S> = CliCommandInput & { readonly result: S };

/**
 * Runs the built CLI against the stack with `--output json`, inheriting only the stack's variables, its origin and the
 * command's own. It decodes the envelope's result with `result` once the run exits with success.
 */
export const runCli = Effect.fn('runCli')(function* <S extends Schema.Codec<unknown, unknown>>({
  result,
  ...command
}: RunCliInput<S>): Effect.fn.Return<CliRun<S['Type']>, ProcessFailed | CliFailed | CliUndecoded> {
  const run = yield* finishedCli({ ...command, binary: CLI_BINARY });

  return yield* cliResult({ args: command.args, run, result, status: SUCCESS_STATUS });
});
