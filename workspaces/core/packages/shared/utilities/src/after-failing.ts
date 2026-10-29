import type { SettleRunInput } from './types.ts';

/** Runs `run` once the promise rejects, never once it fulfills, and then settles as the promise did. */
export async function afterFailing<A>({ promise, run }: SettleRunInput<A>): Promise<A> {
  await promise.then(() => undefined, run);

  return await promise;
}
