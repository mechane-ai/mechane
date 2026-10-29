import { reconcileSlackDelivery } from '@mechane/integrations';
import type { SlackReconciliation } from '@mechane/integrations';
import { SlackDeliveryStatus } from '@mechane/records';
import { DateTime, Option } from 'effect';
import { SLACK_RECONCILE_DELAY } from './constants.ts';
import type { PreparedSlackDelivery, RunSlackDeliveryInput } from './types.ts';

const SLACK_RECONCILIATION_MAX_COUNT = 12;

type ReconcileStoredSlackDeliveryInput = Pick<RunSlackDeliveryInput, 'store' | 'delivery'> &
  PreparedSlackDelivery & { readonly contentSha256: string; readonly now: DateTime.Utc };

type ReadStoredSlackOutcomeInput = Omit<ReconcileStoredSlackDeliveryInput, 'store' | 'now'>;

/** Settles only positive history evidence and bounds repeated inconclusive recovery. */
export async function reconcileStoredSlackDelivery({
  store,
  now,
  ...input
}: ReconcileStoredSlackDeliveryInput): Promise<void> {
  const observed = await readStoredSlackOutcome(input);
  const delivery = input.delivery;
  const reconciliationCount = delivery.reconciliationCount + 1;
  const later = DateTime.addDuration(now, SLACK_RECONCILE_DELAY);
  const nextAttemptAt = Option.liftPredicate(later, () => reconciliationCount < SLACK_RECONCILIATION_MAX_COUNT);
  const receipt = { deliveryId: delivery.id, reconciliationCount, messageTimestamp: observed.messageTimestamp };

  if (Option.isSome(observed.messageTimestamp)) {
    const update = {
      ...receipt,
      status: SlackDeliveryStatus.Sent,
      nextAttemptAt: Option.none(),
      lastError: Option.none(),
    };

    await store.atomic({ run: (tables) => tables.updateSlackDelivery(update) });

    return;
  }

  const update = {
    ...receipt,
    status: SlackDeliveryStatus.Uncertain,
    nextAttemptAt,
    lastError: Option.some(observed.reason),
  };

  await store.atomic({ run: (tables) => tables.updateSlackDelivery(update) });
}

async function readStoredSlackOutcome({
  delivery,
  installation,
  destination,
  historyToken,
  contentSha256,
}: ReadStoredSlackOutcomeInput): Promise<SlackReconciliation> {
  const attemptedAt = Option.getOrElse(delivery.attemptedAt, () => delivery.createdAt);
  const savedDigest = Option.getOrElse(delivery.contentSha256, () => contentSha256);

  return await reconcileSlackDelivery({
    installation,
    token: historyToken,
    destination,
    deliveryId: delivery.id,
    contentSha256: savedDigest,
    attemptedAt,
  });
}
