import type { AbortInput } from './types.ts';

/** Never fulfills: it rejects with the signal's reason once the signal aborts, at once when it already has. */
export async function abortRejection({ signal }: AbortInput): Promise<never> {
  signal.throwIfAborted();

  const { promise, reject } = Promise.withResolvers<never>();

  signal.addEventListener('abort', () => reject(signal.reason), { once: true });

  return await promise;
}
