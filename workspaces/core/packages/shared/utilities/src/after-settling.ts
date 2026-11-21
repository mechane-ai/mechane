import type { SettleRunInput } from './types.ts';

/** Runs `run` once the promise settles, either way, and then settles as the promise did. */
export async function afterSettling<A>({ promise, run }: SettleRunInput<A>): Promise<A> {
  await Promise.allSettled([promise]);
  run();

  return await promise;
}
