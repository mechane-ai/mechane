import { SUCCESS_STATUS } from '@mechane/program';
import { Effect } from 'effect';
import type { Schema, Scope } from 'effect';
import { approveInBrowser } from '../browser/approve-in-browser.ts';
import { presentKey } from '../browser/present-key.ts';
import { cliResult } from '../cli/cli-result.ts';
import { startCli } from '../cli/start-cli.ts';
import type { BrowserRefused } from '../errors.ts';
import type { CliRun, ScenarioFailure } from '../types.ts';
import type { ApprovedCliInput } from './types.ts';

/** A CLI command to run through a device approval, and the keys presented to that approval before a browser's. */
type ApprovedRunInput<S> = ApprovedCliInput<S> & { readonly presentedKeys: ReadonlyArray<string> };

/**
 * Starts the command, presents each key to its device page, approves it in a browser by typing the code its notice
 * named, and decodes the result.
 */
export const approvedRun = Effect.fn('approvedRun')(function* <S extends Schema.Codec<unknown, unknown>>({
  stack,
  args,
  account,
  result,
  presentedKeys,
}: ApprovedRunInput<S>): Effect.fn.Return<CliRun<S['Type']>, ScenarioFailure, Scope.Scope> {
  const started = yield* startCli({ stack, args, environment: account.environment });
  const approval = yield* started.approval;
  const present: (token: string) => Effect.Effect<void, BrowserRefused> = (token) => presentKey({ approval, token });

  yield* Effect.forEach(presentedKeys, present, { discard: true, concurrency: 1 });
  yield* approveInBrowser({ approval, login: account.login });

  const run = yield* started.finished;

  return yield* cliResult({ args, run, result, status: SUCCESS_STATUS });
}, Effect.scoped);
