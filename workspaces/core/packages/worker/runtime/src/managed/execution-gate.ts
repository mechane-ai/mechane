import type { ManagedIdentitySlot } from '@mechane/agent-slot';
import { serialCalls } from '@mechane/utilities';
import type { ManagedExecution } from './provider-types.ts';

export type ExclusiveEffect = <T>(signal: AbortSignal | undefined, effect: () => Promise<T>) => Promise<T>;

export function createExecutionGate(slot: ManagedIdentitySlot, read: () => Promise<ManagedExecution>) {
  const effects = serialCalls();
  const held: { epoch: number | null } = { epoch: null };

  async function currentEpoch(): Promise<number> {
    const expected = held.epoch;

    if (expected === null || (await slot.epoch()) !== expected || held.epoch !== expected) {
      throw new Error('The agent lost its execution slot');
    }

    return expected;
  }

  async function run<T>(signal: AbortSignal | undefined, effect: (epoch: number) => Promise<T>): Promise<T> {
    return await effects.run({
      run: async () => {
        signal?.throwIfAborted();

        const epoch = await slot.acquire(signal);
        held.epoch = epoch;

        try {
          signal?.throwIfAborted();

          return await effect(epoch);
        } finally {
          held.epoch = null;

          await slot.release(epoch);
        }
      },
    });
  }

  async function withRequest<T>(
    providerSessionId: string,
    signal: AbortSignal | undefined,
    effect: (current: () => Promise<ManagedExecution>) => Promise<T>,
  ): Promise<T> {
    const start = await read();

    if (providerSessionId !== start.providerSessionId) {
      throw new Error('The model request belongs to another conversation');
    }

    return await run(signal, async (epoch) => {
      async function current(): Promise<ManagedExecution> {
        signal?.throwIfAborted();

        const owner = await read();

        const originChanged = owner.epoch !== start.epoch || owner.activationId !== start.activationId;

        if (originChanged || owner.providerSessionId !== providerSessionId || (await currentEpoch()) !== epoch) {
          throw new Error('The model request lost its execution slot');
        }

        return { ...owner, epoch };
      }

      await current();

      return await effect(current);
    });
  }

  return { run, currentEpoch, withRequest };
}
