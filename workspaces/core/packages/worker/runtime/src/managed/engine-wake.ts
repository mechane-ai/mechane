import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { Harness } from '@earendil-works/pi-durable';
import { ActiveNativeSessions, sessionState, Slot } from './scheduler.ts';

const ACTIVE_WAKE_MS = 1000;

export async function managedWakeDeadline(
  harness: Harness,
  pending: ReadonlyArray<number | null>,
): Promise<number | null> {
  const native = harness.wake();

  const running = await harness.commit(async (transaction) => {
    const slot = await transaction.doc(Slot);

    if (slot.owner !== null || slot.head !== null) {
      return true;
    }

    if (native.active) {
      for (const id of await ActiveNativeSessions.allInTransaction(transaction)) {
        const state = await sessionState(transaction, id);

        const isAdvancing = state.submission !== null && state.waiting === null && !state.isBudgetReached;

        if (state.retiringConversation !== null || isAdvancing) {
          return true;
        }
      }
    }

    return false;
  }, BACKGROUND_CONTEXT);

  const deadlines: Array<number> = [];

  if (running) {
    deadlines.push(Date.now() + ACTIVE_WAKE_MS);
  }

  if (native.at !== undefined) {
    deadlines.push(native.at);
  }

  for (const deadline of pending) {
    if (deadline !== null) {
      deadlines.push(deadline);
    }
  }

  if (deadlines.length === 0) {
    return null;
  }

  return Math.min(...deadlines);
}
