import { observeEvent } from '@mechane/utilities';
import { openIdentitySlotStore } from './store/identity-slot.ts';

export type ManagedIdentitySlot = {
  readonly acquire: (signal?: AbortSignal) => Promise<number>;
  readonly epoch: () => Promise<number | null>;
  readonly release: (expectedEpoch: number) => Promise<void>;
};

export function createManagedIdentitySlots(storage: Pick<DurableObjectStorage, 'get' | 'transaction'>) {
  const store = openIdentitySlotStore(storage);
  const changes = new EventTarget();

  function notify(id: string | null): void {
    if (id === null) {
      return;
    }

    const change = new Event(id);

    changes.dispatchEvent(change);
  }

  function forSession(id: string): ManagedIdentitySlot {
    let lease: 'available' | 'waiting' | number = 'available';

    async function waitForGrant(signal: AbortSignal): Promise<number | null> {
      signal.throwIfAborted();

      const change = observeEvent({ source: changes, type: id, stop: signal });

      try {
        const epoch = await store.request(id);

        signal.throwIfAborted();

        if (epoch === null) {
          await change.observed;
        }

        return epoch;
      } finally {
        change.dispose();
      }
    }

    async function acquire(signal: AbortSignal = new AbortController().signal): Promise<number> {
      signal.throwIfAborted();

      if (lease !== 'available') {
        throw new Error('A managed effect already holds or awaits this slot');
      }

      lease = 'waiting';

      try {
        let epoch = await waitForGrant(signal);

        while (epoch === null) {
          epoch = await waitForGrant(signal);
        }

        lease = epoch;

        return epoch;
      } catch (cause) {
        try {
          const next = await store.cancelWait(id);

          notify(next);
        } finally {
          lease = 'available';
        }

        throw cause;
      }
    }

    async function release(expectedEpoch: number): Promise<void> {
      const next = await store.release(id, expectedEpoch);

      if (lease === expectedEpoch) {
        lease = 'available';
      }

      notify(next);
    }

    return { acquire, epoch: async () => await store.epoch(id), release };
  }

  return {
    forSession,
    attention: store.attention,
    async remove(id: string) {
      const next = await store.remove(id);

      notify(id);
      notify(next);
    },
    async recover() {
      await store.recover();
    },
  };
}
