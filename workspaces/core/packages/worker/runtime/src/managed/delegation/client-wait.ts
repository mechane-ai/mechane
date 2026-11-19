import type { Tx } from '@earendil-works/pi-durable';
import { indexedEvents } from '../event-log/collections.ts';
import { CallReceipts, Sessions } from '../scheduler.ts';
import { pendingChildCalls } from './inputs.ts';
import type { Child } from './records.ts';

type DelegationWait = { readonly isBudgetPaused?: true; readonly waitingForClientToolUseId?: string };

export async function readDelegationWait(
  transaction: Tx,
  threadId: string,
  pageOffset: number,
): Promise<DelegationWait> {
  const state = await transaction.doc(Sessions, threadId, null);
  const isBusy = state.status !== 'idle' || state.interrupt !== null;

  if (isBusy || state.isArchived || state.mutationId !== null) {
    return {};
  }

  const tail = await indexedEvents(threadId, null, 'processed').countInTransaction(transaction);

  if (tail !== pageOffset) {
    return {};
  }

  if (state.isBudgetReached) {
    return { isBudgetPaused: true };
  }

  if (state.waiting !== null) {
    const receipt = await transaction.doc(CallReceipts, JSON.stringify([threadId, state.waiting]), null);
    const isClientOwned = receipt.nativeKind === 'custom' && receipt.stage === 'result';

    if (isClientOwned && receipt.resultId === '' && receipt.eventId === state.waiting) {
      return { waitingForClientToolUseId: state.waiting };
    }
  }

  return {};
}

export async function stillWaitingForClient(transaction: Tx, child: Child, toolUseId: string | undefined) {
  if (toolUseId === undefined) {
    return false;
  }

  const current = await pendingChildCalls(child.origin.sessionId).read(transaction, child.origin.threadId);

  return current === toolUseId;
}
