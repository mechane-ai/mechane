import type { Stack } from '@mechane/stack';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { signedInAccount } from '../approvals/signed-in-account.ts';
import type { ScenarioFailure } from '../types.ts';
import { talkingMech } from './talking-mech.ts';
import type { TalkingMech } from './types.ts';

/** A mech of a fresh account, on the scripted upstream's offer of that name. */
type SignedInMechInput = { readonly stack: Stack; readonly offer: keyof Stack['modelUpstream']['offers'] };

/** Signs a fresh account in and creates its talking mech on one of the scripted upstream's offers. */
export const signedInMech = Effect.fn('signedInMech')(function* ({
  stack,
  offer,
}: SignedInMechInput): Effect.fn.Return<TalkingMech, ScenarioFailure, Scope.Scope> {
  const account = yield* signedInAccount({ stack });

  return yield* talkingMech({ stack, account, model: stack.modelUpstream.offers[offer].id });
});
