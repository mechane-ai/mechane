import { Effect } from 'effect';
import type { Duration } from 'effect';
import { OriginUnreachable, RequestTimedOut } from './errors.ts';

/** One request, how long it and the read of its answer may take, and the read. */
type AnswerWithinInput<A, E> = {
  readonly url: URL;
  readonly init: RequestInit;
  readonly timeout: Duration.Duration;
  readonly read: (response: Response) => Effect.Effect<A, E>;
};

/** One request, and the read of the answer it gets. */
type ExchangeInput<A, E> = Omit<AnswerWithinInput<A, E>, 'timeout'>;

/**
 * Sends one request and reads its answer, both within the timeout. A redirect answers as itself, so a key never follows
 * one to another origin.
 */
export const answerWithin = Effect.fn('answerWithin')(function* <A, E>({
  url,
  init,
  timeout,
  read,
}: AnswerWithinInput<A, E>): Effect.fn.Return<A, E | OriginUnreachable | RequestTimedOut> {
  const late = new RequestTimedOut({ url, timeout });

  return yield* exchange({ url, init, read }).pipe(
    Effect.timeoutOrElse({ duration: timeout, orElse: () => Effect.fail(late) }),
  );
});

/** Sends one request without following a redirect, and reads the answer it gets. */
const exchange = Effect.fn('exchange')(function* <A, E>({
  url,
  init,
  read,
}: ExchangeInput<A, E>): Effect.fn.Return<A, E | OriginUnreachable> {
  const response = yield* Effect.tryPromise({
    try: (signal) => fetch(url, { ...init, redirect: 'manual', signal }),
    catch: (cause) => new OriginUnreachable({ url, reason: String(cause) }),
  });

  return yield* read(response);
});
