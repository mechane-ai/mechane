import { Effect } from 'effect';
import { freshAccount } from '../accounts/fresh-account.ts';
import { SignedIn } from '../schemas.ts';
import type { Account, ScenarioFailure, StackInput } from '../types.ts';
import { approvedCli } from './approved-cli.ts';

/** A fresh account whose CLI signed in through a device approval, which signed its GitHub login up. */
export const signedInAccount = Effect.fn('signedInAccount')(function* ({
  stack,
}: StackInput): Effect.fn.Return<Account, ScenarioFailure> {
  const account = yield* freshAccount({ stack });

  yield* approvedCli({ stack, args: ['auth', 'login'], account, result: SignedIn });

  return account;
});
