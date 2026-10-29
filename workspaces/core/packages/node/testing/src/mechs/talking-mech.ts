import { Mech } from '@mechane/protocol';
import type { Stack } from '@mechane/stack';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { runCli } from '../cli/run-cli.ts';
import type { Account, ScenarioFailure } from '../types.ts';
import { LOG_START } from './constants.ts';
import { heldMech } from './held-mech.ts';
import type { TalkingMech } from './types.ts';

type TalkingMechInput = { readonly stack: Stack; readonly account: Account; readonly model: string };

/** Creates a mech of the model in the account's workspace, and holds it as a talking mech from its log's start. */
export const talkingMech = Effect.fn('talkingMech')(function* ({
  stack,
  account,
  model,
}: TalkingMechInput): Effect.fn.Return<TalkingMech, ScenarioFailure, Scope.Scope> {
  const args = ['mech', 'create', '--name', account.login, '--model', model];
  const { result } = yield* runCli({ stack, args, environment: account.environment, result: Mech });

  return yield* heldMech({ stack, account, mechId: result.id, after: LOG_START });
});
