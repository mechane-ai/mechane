import { Effect } from 'effect';
import type { Schema } from 'effect';
import type { CliRun, ScenarioFailure } from '../types.ts';
import { approvedRun } from './approved-run.ts';
import type { ApprovedCliInput } from './types.ts';

/**
 * Runs a CLI command that waits on a device approval, approves it in a browser as the account's login, and decodes the
 * command's result.
 */
export const approvedCli = Effect.fn('approvedCli')(function* <S extends Schema.Codec<unknown, unknown>>({
  stack,
  args,
  account,
  result,
}: ApprovedCliInput<S>): Effect.fn.Return<CliRun<S['Type']>, ScenarioFailure> {
  return yield* approvedRun({ stack, args, account, result, presentedKeys: [] });
});
