import type { Context } from '@earendil-works/chord/context';
import type { Harness } from '@earendil-works/pi-durable';
import { observeEvent } from '@mechane/utilities';
import { Slot } from './scheduler.ts';

export async function waitForOwner(harness: Harness, id: string, context: Context): Promise<void> {
  const changed = new EventTarget();
  const granted = new AbortController();
  const wait = observeEvent({ source: changed, type: 'settled', stop: context.abortSignal ?? granted.signal });

  try {
    const observation = await harness.observeDoc(
      Slot,
      {
        advance(change) {
          if (change.kind === 'value' && change.value.owner === id) {
            granted.abort();
            changed.dispatchEvent(new Event('settled'));
          }
        },
        end() {
          changed.dispatchEvent(new Event('settled'));
        },
      },
      context,
    );

    if (observation === undefined) {
      throw new Error('Execution slot is missing');
    }

    try {
      context.abortSignal?.throwIfAborted();

      if (observation.value.owner !== id) {
        await wait.observed;
        context.abortSignal?.throwIfAborted();

        if (!granted.signal.aborted) {
          throw new Error('Execution ownership wait ended');
        }
      }
    } finally {
      observation.detach();
    }
  } finally {
    wait.dispose();
  }
}
