import { Delivery } from '@mechane/protocol';
import { InboxItemReceipt } from '@mechane/rpc';
import { Option } from 'effect';
import { decideInboxItemReceipt } from '../inbox/decide-inbox-item-receipt.ts';
import type { NowInput, TablesInput } from '../types.ts';
import { readContinuationOwner } from './read-continuation-owner.ts';

/** A due wakeup enters the ordinary inbox atomically and once; paused mechs retain it until resumed. */
export function advanceThreadContinuations({ store, now }: TablesInput & NowInput): void {
  const mech = readContinuationOwner({ store });

  if (Option.isNone(mech)) {
    return;
  }

  for (const continuation of store.dueThreadContinuations({ now }).slice(0, 1)) {
    const note = Option.getOrElse(continuation.note, () => 'Check the current external state and continue this work.');
    const text = `[Scheduled continuation]\nWork: ${continuation.title}\nThread: ${continuation.threadId}\n${note}\nResume this work. Reconcile external results before retrying actions. If still waiting, schedule another wakeup; resolve the thread when finished.`;

    const decision = decideInboxItemReceipt({
      store,
      now,
      inboxItemId: continuation.inboxItemId,
      text,
      delivery: Delivery.WhenIdle,
      senderId: mech.value.id,
    });

    if (InboxItemReceipt.guards.Received(decision.answer)) {
      store.finishThreadContinuation({ taskId: continuation.taskId });
    }
  }
}
