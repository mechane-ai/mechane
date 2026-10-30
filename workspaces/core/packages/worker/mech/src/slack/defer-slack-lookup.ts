import { DateTime, Option } from 'effect';
import { SLACK_RECONCILE_DELAY } from './constants.ts';
import type { RunSlackDeliveryInput } from './types.ts';

type DeferSlackLookupInput = Pick<RunSlackDeliveryInput, 'store' | 'delivery'> & { readonly reason: string };

/** Keeps the existing delivery state while a transient lookup is retried. */
export async function deferSlackLookup({ store, delivery, reason }: DeferSlackLookupInput): Promise<void> {
  const now = DateTime.nowUnsafe();
  const deadline = DateTime.addDuration(now, SLACK_RECONCILE_DELAY);

  const update = {
    deliveryId: delivery.id,
    status: delivery.status,
    nextAttemptAt: Option.some(deadline),
    messageTimestamp: Option.none(),
    lastError: Option.some(reason),
    reconciliationCount: delivery.reconciliationCount,
  };

  await store.atomic({ run: (tables) => tables.updateSlackDelivery(update) });
}
