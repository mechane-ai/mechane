import type { PendingItemRow } from '@mechane/mech-store';
import { WatchStatus } from '@mechane/protocol';
import { Option } from 'effect';
import type { TablesInput } from '../types.ts';

type WatchDeliveryInput = TablesInput & { readonly pending: PendingItemRow };

/** Holds queued watch work while its schedule is paused; interactive inbox items remain eligible. */
export function isWatchDeliveryReady({ store, pending }: WatchDeliveryInput): boolean {
  const watch = store.watchForInboxItem({ inboxItemId: pending.id });

  return !Option.exists(watch, ({ status }) => status === WatchStatus.Paused);
}
