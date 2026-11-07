import { Delivery, ExternalRequestStatus } from '@mechane/protocol';
import { InboxItemReceipt } from '@mechane/rpc';
import { Option, Schema } from 'effect';
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

    const request = Option.match(continuation.requestResult, {
      onNone: () => '',
      onSome: (result) => {
        const encoded = Schema.encodeSync(ExternalRequestStatus)(result);
        const details = JSON.stringify(encoded);

        return `\nExternal request: ${details}\nThe request outcome does not prove the task completed. Recheck current access before acting.`;
      },
    });

    const text = `[Scheduled continuation]\nWork: ${continuation.title}\nThread: ${continuation.threadId}\n${note}${request}\nResume this work. Reconcile external results before retrying actions. If still waiting, schedule another wakeup; resolve the thread when finished.`;

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
