import { SlackDeliveryStatus } from '@mechane/records';
import { Option } from 'effect';
import type { RunSlackDeliveryInput } from './types.ts';

type BlockedSlackStatusInput = { readonly status: SlackDeliveryStatus };
type BlockSlackDeliveryInput = Pick<RunSlackDeliveryInput, 'store' | 'delivery'> & { readonly reason: string };

/** Stops pending delivery while preserving uncertainty for a possibly accepted write. */
export async function blockSlackDelivery({ store, delivery, reason }: BlockSlackDeliveryInput): Promise<void> {
  const update = {
    deliveryId: delivery.id,
    status: blockedSlackStatus({ status: delivery.status }),
    nextAttemptAt: Option.none(),
    messageTimestamp: Option.none(),
    lastError: Option.some(reason),
    reconciliationCount: delivery.reconciliationCount,
  };

  await store.atomic({ run: (tables) => tables.updateSlackDelivery(update) });
}

function blockedSlackStatus({ status }: BlockedSlackStatusInput): SlackDeliveryStatus {
  if (status === SlackDeliveryStatus.Uncertain) {
    return SlackDeliveryStatus.Uncertain;
  }

  return SlackDeliveryStatus.Blocked;
}
