import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { Harness, Tx } from '@earendil-works/pi-durable';
import { managedOutcomeConversation } from './outcomes.ts';
import { ActiveNativeSessions, release, Sessions, sessionState } from './scheduler.ts';

export async function retireManagedFocus(transaction: Tx, sessionId: string): Promise<void> {
  const state = await sessionState(transaction, sessionId);

  if (state.submission !== null && state.retiringConversation === null) {
    state.retiringConversation = await managedOutcomeConversation(transaction, state);
  }

  state.status = 'terminated';
  state.stopReason = null;
  state.activeEvent = null;
  state.activation = null;
  state.submission = null;
  state.interrupt = null;
  state.waiting = null;
  state.pendingHead = state.pendingTail;

  await release(transaction, sessionId);

  if (state.retiringConversation === null) {
    await ActiveNativeSessions.remove(transaction, sessionId);
  } else {
    await ActiveNativeSessions.put(transaction, sessionId, sessionId);
  }
}

async function abortFocus(harness: Harness, id: string): Promise<void> {
  const state = await harness.snapshot(Sessions, id, BACKGROUND_CONTEXT);
  const nativeId = state?.retiringConversation;

  if (nativeId === undefined || nativeId === null) {
    return;
  }

  const conversation = await harness.conversation(nativeId, BACKGROUND_CONTEXT);

  if (conversation === undefined) {
    throw new Error('The retiring conversation is missing.');
  }

  await conversation.abort(BACKGROUND_CONTEXT);
  await harness.commit(async (transaction) => {
    const focus = await sessionState(transaction, id);

    if (focus.retiringConversation === nativeId) {
      focus.retiringConversation = null;

      await ActiveNativeSessions.remove(transaction, id);
    }
  }, BACKGROUND_CONTEXT);
}

export async function abortRetiredFocus(harness: Harness): Promise<void> {
  for (const id of await ActiveNativeSessions.all(harness)) {
    await abortFocus(harness, id);
  }
}
