import { DateTime, Option } from 'effect';
import { SLACK_RECONCILE_DELAY } from './constants.ts';
import type { RunSlackDeliveryInput } from './types.ts';

type DeferSlackBindingLookupInput = Pick<RunSlackDeliveryInput, 'store' | 'delivery'>;

/** Keeps the existing delivery state while a transient binding lookup is retried. */
export async function deferSlackBindingLookup({ store, delivery }: DeferSlackBindingLookupInput): Promise<void> {
  const now = DateTime.nowUnsafe();
  const deadline = DateTime.addDuration(now, SLACK_RECONCILE_DELAY);

  const update = {
    deliveryId: delivery.id,
    status: delivery.status,
    nextAttemptAt: Option.some(deadline),
    messageTimestamp: Option.none(),
    lastError: Option.some('binding_unavailable'),
    reconciliationCount: delivery.reconciliationCount,
  };

  await store.atomic({ run: (tables) => tables.updateSlackDelivery(update) });
}
