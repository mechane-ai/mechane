import type { WatchRow } from '@mechane/mech-store';
import { Delivery, MechStatus } from '@mechane/protocol';
import { InboxItemId } from '@mechane/records';
import { DateTime, Duration, Option } from 'effect';
import { decideInboxItemReceipt } from '../inbox/decide-inbox-item-receipt.ts';
import { recordTurnCancel } from '../turns/record-turn-cancel.ts';
import type { NowInput, TablesInput } from '../types.ts';
import { watchPrompt } from './watch-prompt.ts';

type QueueWatchCheckInput = TablesInput & NowInput & { readonly watch: WatchRow };

/** Settles checks, cancels expired turns, and coalesces each due schedule into one ordinary inbox item. */
export function advanceWatches({ store, now }: TablesInput & NowInput): void {
  store.settleWatchChecks();

  for (const expired of store.expiredWatchChecks({ now })) {
    recordTurnCancel({ store, turnId: expired.turnId, cancelerId: expired.creatorId, now });
  }

  const mech = store.mech();

  if (Option.isNone(mech) || mech.value.status !== MechStatus.Active) {
    return;
  }

  for (const watch of store.dueWatches({ now })) {
    const interval = Duration.seconds(watch.intervalSeconds);
    const nextRunAt = DateTime.addDuration(now, interval);

    store.advanceWatch({ watchId: watch.id, nextRunAt });
    queueWatchCheck({ store, watch, now });
  }
}

function queueWatchCheck({ store, watch, now }: QueueWatchCheckInput): void {
  if (store.unfinishedWatchCheckCount({ watchId: watch.id }) > 0) {
    return;
  }

  const inboxItemId = InboxItemId.make(crypto.randomUUID());
  const text = watchPrompt({ watch, now });

  decideInboxItemReceipt({ store, inboxItemId, text, delivery: Delivery.WhenIdle, senderId: watch.creatorId, now });
  store.recordWatchCheck({ watchId: watch.id, inboxItemId, maxCheckSeconds: watch.maxCheckSeconds, now });
}
