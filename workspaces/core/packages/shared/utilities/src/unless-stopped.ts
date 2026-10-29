import { Option } from 'effect';

/** A promise, and the promise whose settling first stops the wait for it. */
type UnlessStoppedInput<A> = { readonly promise: Promise<A>; readonly stop: Promise<unknown> };

/**
 * The promise's value, or none once `stop` settles first. The race subscribes to the promise it leaves behind, so that
 * promise's later end is never unhandled.
 */
export async function unlessStopped<A>({ promise, stop }: UnlessStoppedInput<A>): Promise<Option.Option<A>> {
  const stopped: () => Option.Option<A> = () => Option.none();

  return await Promise.race([promise.then(Option.some), stop.then(stopped)]);
}
