import { Effect } from 'effect';
import type { Schema } from 'effect';
import { runCli } from '../cli/run-cli.ts';
import type { ScenarioFailure } from '../types.ts';
import type { MechCommandInput, MechInput } from './types.ts';

/** A CLI command to run on a mech of an account. */
type MechCommandRunInput<S> = MechInput & MechCommandInput<S>;

/** Runs a CLI command on the mech with the account's CLI, and decodes its result as the scenario expects. */
export const mechCommand = Effect.fn('mechCommand')(function* <S extends Schema.Codec<unknown, unknown>>({
  stack,
  account,
  mechId,
  words,
  ids,
  result,
}: MechCommandRunInput<S>): Effect.fn.Return<S['Type'], ScenarioFailure> {
  const run = yield* runCli({ stack, args: [...words, mechId, ...ids], environment: account.environment, result });

  return run.result;
});
