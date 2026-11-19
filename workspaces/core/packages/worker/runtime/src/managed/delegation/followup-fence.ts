import type { Tx } from '@earendil-works/pi-durable';
import { actorRecordSet } from '../../actor/record-store.ts';

function pending(threadId: string) {
  return actorRecordSet(`managed.pending-thread-messages:${threadId}`);
}

export async function awaitFollowup(transaction: Tx, threadId: string, deliveryId: string) {
  await pending(threadId).put(transaction, deliveryId, deliveryId);
}

export async function observeFollowup(transaction: Tx, threadId: string, deliveryId: string) {
  await pending(threadId).remove(transaction, deliveryId);
}

export async function hasPendingFollowup(transaction: Tx, threadId: string) {
  return (await pending(threadId).countInTransaction(transaction)) > 0;
}

export async function eraseFollowups(transaction: Tx, threadId: string) {
  await pending(threadId).retire(transaction);
}
