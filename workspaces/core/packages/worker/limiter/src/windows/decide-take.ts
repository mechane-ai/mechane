import type { LimiterStore, LimitWindowRow } from '@mechane/limiter-store';
import { TakeAnswer } from '@mechane/rpc';
import type { TakeInput } from '@mechane/rpc';
import { DateTime, Duration, Option } from 'effect';

/** One request of a policy, decided against the limiter's store at the call's instant. */
type DecideTakeInput = {
  readonly store: LimiterStore;
  readonly policy: TakeInput['policy'];
  readonly limit: TakeInput['limit'];
  readonly now: DateTime.Utc;
};

/**
 * Counts one request against the policy's window, or refuses it until the full window ends. A window opens at the first
 * request after the last one ended, so no boundary lets a burst through twice.
 */
export function decideTake({ store, policy, limit, now }: DecideTakeInput): typeof TakeAnswer.Encoded {
  const span = Duration.seconds(limit.windowSeconds);
  const stored = store.limitWindow({ policy });

  const window: LimitWindowRow = (() => {
    if (Option.isSome(stored) && DateTime.isLessThan(now, DateTime.addDuration(stored.value.openedAt, span))) {
      return stored.value;
    }

    return { openedAt: now, taken: 0 };
  })();

  if (window.taken >= limit.requests) {
    const retryAfter = DateTime.distance(now, DateTime.addDuration(window.openedAt, span));

    return TakeAnswer.cases.Limited.make({ retryAfterSeconds: Math.ceil(Duration.toSeconds(retryAfter)) });
  }

  store.writeWindow({ policy, openedAt: window.openedAt, taken: window.taken + 1 });

  return TakeAnswer.cases.Allowed.make({});
}
