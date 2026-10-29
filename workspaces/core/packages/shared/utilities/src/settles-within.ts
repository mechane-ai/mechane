import { Duration } from 'effect';

/** A promise, and how long it has to settle in. */
type SettlesWithinInput = { readonly promise: Promise<unknown>; readonly span: Duration.Duration };

/**
 * Whether the promise fulfills within `span`, waiting no longer, and rejecting as it does; the one place an object's
 * code races its work against a timer.
 */
export async function settlesWithin({ promise, span }: SettlesWithinInput): Promise<boolean> {
  const late = Promise.withResolvers<boolean>();
  const timer = setTimeout(() => late.resolve(false), Duration.toMillis(span));

  return await Promise.race([promise.then(() => true), late.promise]).finally(() => clearTimeout(timer));
}
