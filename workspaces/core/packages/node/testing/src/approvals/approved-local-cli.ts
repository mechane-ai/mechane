import { SUCCESS_STATUS } from '@mechane/program';
import { Effect } from 'effect';
import type { Schema, Scope } from 'effect';
import { approveInBrowser } from '../browser/approve-in-browser.ts';
import { cliResult } from '../cli/cli-result.ts';
import { startCli } from '../cli/start-cli.ts';
import type { CliRun, ScenarioFailure } from '../types.ts';
import type { ApprovedCliInput } from './types.ts';

type ApprovedLocalCliInput<S> = ApprovedCliInput<S> & { readonly bootstrapSecret: string };

/** Signs in as the local owner and approves the device request of a running CLI command. */
export const approvedLocalCli = Effect.fn('approvedLocalCli')(function* <S extends Schema.Codec<unknown, unknown>>({
  stack,
  args,
  account,
  result,
  bootstrapSecret,
}: ApprovedLocalCliInput<S>): Effect.fn.Return<CliRun<S['Type']>, ScenarioFailure, Scope.Scope> {
  const started = yield* startCli({ stack, args, environment: account.environment });
  const approval = yield* started.approval;

  yield* approveInBrowser({ approval, bootstrapSecret });

  const run = yield* started.finished;

  return yield* cliResult({ args, run, result, status: SUCCESS_STATUS });
}, Effect.scoped);
