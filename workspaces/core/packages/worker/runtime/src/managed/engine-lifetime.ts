import { BACKGROUND_CONTEXT, withAbortSignal } from '@earendil-works/chord/context';
import { SessionFailed } from '@earendil-works/pi-durable';
import type { Harness } from '@earendil-works/pi-durable';
import { ActiveNativeSessions, sessionState, Slot } from './scheduler.ts';

export function openNativeLifetime(harness: Harness, waitUntil: (pending: Promise<void>) => void) {
  const closing = new AbortController();
  const active: { untilIdle?: Promise<void>; closing?: Promise<void> } = {};

  async function waitForIdle() {
    try {
      await harness.waitForIdle(withAbortSignal(closing.signal, BACKGROUND_CONTEXT));
    } catch (failure) {
      if (!closing.signal.aborted || failure instanceof SessionFailed) {
        throw failure;
      }
    } finally {
      try {
        await active.closing;
      } finally {
        delete active.untilIdle;
      }
    }
  }

  function resume() {
    harness.resume();

    active.untilIdle ??= waitForIdle();

    waitUntil(active.untilIdle);
  }

  async function canPark() {
    if (!harness.wake().active) {
      return false;
    }

    return await harness.commit(async (transaction) => {
      const slot = await transaction.doc(Slot);

      if (slot.owner !== null || slot.head !== null) {
        return false;
      }

      const pending = await ActiveNativeSessions.allInTransaction(transaction);

      for (const id of pending) {
        const state = await sessionState(transaction, id);

        if (state.waiting === null || state.interrupt !== null || state.retiringConversation !== null) {
          return false;
        }
      }

      return pending.length > 0;
    }, BACKGROUND_CONTEXT);
  }

  async function close() {
    const joined = active.untilIdle;
    active.closing = harness.close(BACKGROUND_CONTEXT);

    closing.abort();

    try {
      await active.closing;
    } finally {
      await joined;
    }
  }

  return { resume, canPark, close };
}
