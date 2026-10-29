import { InboxItem } from '@mechane/protocol';
import { Effect } from 'effect';
import { runCli } from '../cli/run-cli.ts';
import type { ScenarioFailure } from '../types.ts';
import type { MechInput } from './types.ts';

/** A send of the mech's account, with the arguments after the mech's id. */
type SendArgsInput = MechInput & { readonly args: ReadonlyArray<string> };

/** Sends an inbox item to the mech with the account's CLI, and answers with the item the deployment took. */
export const sentItem = Effect.fn('sentItem')(function* ({
  stack,
  account,
  mechId,
  args,
}: SendArgsInput): Effect.fn.Return<InboxItem, ScenarioFailure> {
  const { result } = yield* runCli({
    stack,
    args: ['inbox', 'send', mechId, ...args],
    environment: account.environment,
    result: InboxItem,
  });

  return result;
});
