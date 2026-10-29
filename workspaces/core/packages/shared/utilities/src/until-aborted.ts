import type { AbortInput } from './types.ts';

/** Resolves once the signal aborts after the call; one listener serves every wait that holds the promise. */
export async function untilAborted({ signal }: AbortInput): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();

  signal.addEventListener('abort', () => resolve(), { once: true });

  await promise;
}
