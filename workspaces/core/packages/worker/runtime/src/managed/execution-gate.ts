import type { ManagedIdentitySlot } from '@mechane/agent-slot';
import { serialCalls } from '@mechane/utilities';
import type { ManagedExecution } from './provider-types.ts';

export type ExclusiveEffect = <T>(
  signal: AbortSignal | undefined,
  effect: (leaseSignal: AbortSignal) => Promise<T>,
) => Promise<T>;

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

  async function run<T>(
    signal: AbortSignal | undefined,
    effect: (leaseSignal: AbortSignal, epoch: number) => Promise<T>,
  ): Promise<T> {
    return await effects.run({
      run: async () => {
        signal?.throwIfAborted();

        const lease = await slot.acquire(signal);
        held.epoch = lease.epoch;

        let activeSignal = lease.signal;

        if (signal !== undefined) {
          activeSignal = AbortSignal.any([signal, lease.signal]);
        }

        try {
          activeSignal.throwIfAborted();

          return await effect(activeSignal, lease.epoch);
        } finally {
          held.epoch = null;

          await slot.release(lease.epoch);
        }
      },
    });
  }

  async function withRequest<T>(
    providerSessionId: string,
    signal: AbortSignal | undefined,
    effect: (current: () => Promise<ManagedExecution>, requestSignal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const start = await read();

    if (providerSessionId !== start.providerSessionId) {
      throw new Error('The model request belongs to another conversation');
    }

    return await run(signal, async (requestSignal, epoch) => {
      async function current(): Promise<ManagedExecution> {
        requestSignal.throwIfAborted();

        const owner = await read();

        const originChanged = owner.epoch !== start.epoch || owner.activationId !== start.activationId;

        if (originChanged || owner.providerSessionId !== providerSessionId || (await currentEpoch()) !== epoch) {
          throw new Error('The model request lost its execution slot');
        }

        return { ...owner, epoch };
      }

      await current();

      return await effect(current, requestSignal);
    });
  }

  return { run, currentEpoch, withRequest };
}
