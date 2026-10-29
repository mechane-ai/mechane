import type { LimitPolicy } from '@mechane/deployment';
import type { ObjectUnavailable, RateLimited } from '@mechane/protocol';
import { Effect, Option } from 'effect';
import { limitRequest } from './limit-request.ts';
import type { WorkerSettings } from './types.ts';

/** One request of an address policy, from the address the platform named, if it named one. */
type LimitAddressInput = {
  readonly settings: WorkerSettings;
  readonly policy: LimitPolicy;
  /** The request's address, none where the platform named none, which leaves the request uncounted. */
  readonly address: Option.Option<string>;
};

/** Counts one request against an address policy, when the platform names the request's address, and else nothing. */
export const limitAddress = Effect.fn('limitAddress')(function* ({
  settings,
  policy,
  address,
}: LimitAddressInput): Effect.fn.Return<void, RateLimited | ObjectUnavailable> {
  if (Option.isNone(address)) {
    return;
  }

  yield* limitRequest({ settings, policy, countedBy: address.value });
});
