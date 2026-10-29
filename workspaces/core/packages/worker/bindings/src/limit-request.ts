import type { LimitPolicy } from '@mechane/deployment';
import { writeLog } from '@mechane/logs';
import { DurableObjectClass, LogEvent, RateLimited } from '@mechane/protocol';
import type { ObjectUnavailable } from '@mechane/protocol';
import { limiterStub, TakeAnswer } from '@mechane/rpc';
import { Effect, Match } from 'effect';
import { callObject } from './call-object.ts';
import type { WorkerSettings } from './types.ts';

/** One request of a policy, for what its limiter counts by: an address, a principal's id or a GitHub user's id. */
type LimitRequestInput = {
  readonly settings: WorkerSettings;
  readonly policy: LimitPolicy;
  readonly countedBy: string;
};

/** A request of a policy that its full window refused, until `retryAfterSeconds` from now. */
type RefuseLimitedInput = { readonly policy: LimitPolicy; readonly retryAfterSeconds: number };

/**
 * Counts one request against a policy in the limiter of `countedBy`, at the limit the deployment gives the policy. A
 * full window refuses the request as rate limited, until the window ends.
 */
export const limitRequest = Effect.fn('limitRequest')(function* ({
  settings,
  policy,
  countedBy,
}: LimitRequestInput): Effect.fn.Return<void, RateLimited | ObjectUnavailable> {
  const limiter = limiterStub({ bindings: settings, policy, countedBy });

  const answer = yield* callObject({
    objectClass: DurableObjectClass.Limiter,
    call: () => limiter.take({ policy, limit: settings.rateLimits[policy] }),
    answer: TakeAnswer,
  });

  return yield* Match.valueTags(answer, {
    Allowed: () => Effect.void,
    Limited: ({ retryAfterSeconds }) => refuseLimited({ policy, retryAfterSeconds }),
  });
});

/** Logs a request a full window refused, and refuses it as rate limited. */
const refuseLimited = Effect.fn('refuseLimited')(function* ({
  policy,
  retryAfterSeconds,
}: RefuseLimitedInput): Effect.fn.Return<never, RateLimited> {
  writeLog({ line: { event: LogEvent.RequestLimited, policy, retryAfterSeconds } });

  return yield* new RateLimited({ retryAfterSeconds });
});
