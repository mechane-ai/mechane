import type { SettleRunInput } from './types.ts';

/** Runs `run` once the promise settles, either way, and then settles as the promise did. */
export async function afterSettling<A>({ promise, run }: SettleRunInput<A>): Promise<A> {
  await promise.then(run, run);

  return await promise;
}
