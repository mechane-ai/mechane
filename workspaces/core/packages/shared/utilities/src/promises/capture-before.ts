import { Duration, Option } from 'effect';
import type { Result } from 'effect';
import { capturePromise } from './capture-promise.ts';

type CaptureBeforeInput<Value> = { readonly promise: Promise<Value>; readonly span: Duration.Duration };

/** Stops waiting at the deadline; a late native result remains observed but cannot reach the caller. */
export async function captureBefore<Value>({
  promise,
  span,
}: CaptureBeforeInput<Value>): Promise<Option.Option<Result.Result<Value, unknown>>> {
  const timeout = Promise.withResolvers<Option.Option<Result.Result<Value, unknown>>>();
  const milliseconds = Duration.toMillis(span);

  const timer = setTimeout(() => {
    const expired = Option.none<Result.Result<Value, unknown>>();

    timeout.resolve(expired);
  }, milliseconds);

  async function settle(): Promise<Option.Option<Result.Result<Value, unknown>>> {
    const result = await capturePromise({ promise });

    return Option.some(result);
  }

  const completion = settle();

  const outcome = await Promise.race([completion, timeout.promise]);

  clearTimeout(timer);

  return outcome;
}
