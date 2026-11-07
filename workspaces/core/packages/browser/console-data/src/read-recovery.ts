import { OperationFailed, OriginUnreachable, RequestTimedOut, ResponseUnreadable, RetryAfter } from '@mechane/client';
import { HttpStatusCode } from '@mechane/records';
import { DateTime, Duration, Option, Schema } from 'effect';

export const REQUEST_TIMEOUT = Duration.seconds(40);
const RETRY_DELAYS_MS = [Duration.toMillis('1 second'), Duration.toMillis('3 seconds')] as const;
const GATEWAY_TIMEOUT_STATUS = 504;

const TRANSIENT_STATUSES: ReadonlySet<number> = new Set([
  HttpStatusCode.BadGateway,
  HttpStatusCode.Unavailable,
  GATEWAY_TIMEOUT_STATUS,
]);

/** A history response failed before its native message envelope could be read. */
export class ReadResponseFailed extends Schema.TaggedError<ReadResponseFailed>()('ReadResponseFailed', {
  status: Schema.Int,
  retryAfter: RetryAfter,
}) {}

/** The complete read, including recovery waits, exhausted its one deadline. */
export class ReadTimedOut extends Schema.TaggedError<ReadTimedOut>()('ReadTimedOut', {}) {}

/** Only explicit temporary HTTP failures and failed fetch exchanges permit another safe read. */
export function isTransientReadFailure(failure: unknown): boolean {
  if (failure instanceof OriginUnreachable) {
    return true;
  }

  if (failure instanceof OperationFailed) {
    return failure.failure._tag === 'ServiceUnavailable' && TRANSIENT_STATUSES.has(failure.status);
  }

  return (
    (failure instanceof ResponseUnreadable || failure instanceof ReadResponseFailed) &&
    TRANSIENT_STATUSES.has(failure.status)
  );
}

function retryDelay(failure: unknown, minimumDelayMs: number): number | undefined {
  if (!isTransientReadFailure(failure)) {
    return undefined;
  }

  if (failure instanceof OriginUnreachable) {
    return minimumDelayMs;
  }

  if (
    failure instanceof OperationFailed ||
    failure instanceof ResponseUnreadable ||
    failure instanceof ReadResponseFailed
  ) {
    const { retryAfter } = failure;

    if (Option.isNone(retryAfter)) {
      return minimumDelayMs;
    }

    if (retryAfter.value === 'invalid') {
      return undefined;
    }

    const retryAtMillis = DateTime.toEpochMillis(retryAfter.value);

    return Math.max(minimumDelayMs, retryAtMillis - Date.now());
  }

  return undefined;
}

async function waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();

  const waited = Promise.withResolvers<void>();
  const timer = setTimeout(() => waited.resolve(), delayMs);

  function abort(): void {
    waited.reject(signal.reason);
  }

  signal.addEventListener('abort', abort, { once: true });

  try {
    await waited.promise;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

type RecoverRead<Value> = {
  readonly signal: AbortSignal;
  readonly read: (signal: AbortSignal, remaining: Duration.Duration) => Promise<Value>;
};

/** Recovers a safe read within its original deadline; callers keep one pending promise and own presentation. */
export async function recoverRead<Value>({ signal, read }: RecoverRead<Value>): Promise<Value> {
  signal.throwIfAborted();

  const timeoutMs = Duration.toMillis(REQUEST_TIMEOUT);
  const expiresAt = performance.now() + timeoutMs;
  const deadline = new AbortController();
  const lifetime = AbortSignal.any([signal, deadline.signal]);
  const aborted = Promise.withResolvers<never>();
  const timer = setTimeout(() => deadline.abort(new ReadTimedOut({})), timeoutMs);

  function abort(): void {
    aborted.reject(lifetime.reason);
  }

  lifetime.addEventListener('abort', abort, { once: true });

  async function attemptRead(): Promise<Value> {
    lifetime.throwIfAborted();

    try {
      const value = await read(lifetime, Duration.millis(Math.max(0, expiresAt - performance.now())));

      lifetime.throwIfAborted();

      return value;
    } catch (failure) {
      lifetime.throwIfAborted();

      if (failure instanceof RequestTimedOut) {
        throw new ReadTimedOut({});
      }

      throw failure;
    }
  }

  async function recover(): Promise<Value> {
    for (const minimumDelayMs of RETRY_DELAYS_MS) {
      try {
        return await attemptRead();
      } catch (failure) {
        lifetime.throwIfAborted();

        const delay = retryDelay(failure, minimumDelayMs);

        if (delay === undefined || delay >= expiresAt - performance.now()) {
          throw failure;
        }

        await waitForRetry(delay, lifetime);
      }
    }

    return await attemptRead();
  }

  try {
    return await Promise.race([recover(), aborted.promise]);
  } finally {
    clearTimeout(timer);
    lifetime.removeEventListener('abort', abort);
  }
}
