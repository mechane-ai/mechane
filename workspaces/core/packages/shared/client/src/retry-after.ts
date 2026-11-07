import { HttpHeader } from '@mechane/records';
import { DateTime, Effect, Option, Schema } from 'effect';

const INVALID_RETRY_AFTER = 'invalid';

/** None means no header; invalid forbids recovery; a UTC instant is the earliest allowed retry. */
export const RetryAfter = Schema.Option(
  Schema.Union([Schema.DateTimeUtcFromMillis, Schema.Literal(INVALID_RETRY_AFTER)]),
).pipe(Schema.withConstructorDefault(Effect.succeed(Option.none())));

export type RetryAfter = typeof RetryAfter.Type;

const HEADER_MAX_CHARACTERS = 128;
const MILLISECONDS_PER_SECOND = 1000;
const readHttpDate = Schema.decodeOption(Schema.DateTimeUtcFromHttpDate);
type ReadRetryAfterInput = { readonly headers: Headers };

/** Preserves a bounded Retry-After deadline without retaining arbitrary response headers. */
export function readRetryAfter({ headers }: ReadRetryAfterInput): RetryAfter {
  const header = headers.get(HttpHeader.RetryAfter);
  const supplied = Option.fromNullishOr(header);

  if (Option.isNone(supplied)) {
    return Option.none();
  }

  const value = supplied.value.trim();

  if (value.length === 0 || value.length > HEADER_MAX_CHARACTERS) {
    return Option.some(INVALID_RETRY_AFTER);
  }

  let retryAt = Option.none<DateTime.Utc>();

  if (/^\d+$/u.test(value)) {
    const now = DateTime.nowUnsafe();
    const nowMillis = DateTime.toEpochMillis(now);
    const retryAtMillis = nowMillis + Number(value) * MILLISECONDS_PER_SECOND;

    if (!Number.isSafeInteger(retryAtMillis)) {
      return Option.some(INVALID_RETRY_AFTER);
    }

    retryAt = DateTime.make(retryAtMillis);
  } else {
    retryAt = readHttpDate(value);
  }

  if (Option.isNone(retryAt)) {
    return Option.some(INVALID_RETRY_AFTER);
  }

  return retryAt;
}
