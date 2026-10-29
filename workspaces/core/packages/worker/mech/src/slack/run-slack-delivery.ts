import { postSlackDelivery, SLACK_REPLY_MAX_CHARS } from '@mechane/integrations';
import { SlackDeliveryClaim } from '@mechane/mech-store';
import { SlackDeliveryStatus } from '@mechane/records';
import { sha256Hex } from '@mechane/utilities';
import { DateTime, Option } from 'effect';
import { SLACK_FIRST_RECONCILIATION_DELAY } from './constants.ts';
import { prepareSlackDelivery } from './prepare-slack-delivery.ts';
import { reconcileStoredSlackDelivery } from './reconcile-stored-slack-delivery.ts';
import { settleSlackPost } from './settle-slack-post.ts';
import type { PreparedSlackDelivery, RunSlackDeliveryInput } from './types.ts';

type PostStoredSlackDeliveryInput = Pick<RunSlackDeliveryInput, 'store' | 'delivery'> &
  PreparedSlackDelivery & { readonly text: string; readonly contentSha256: string; readonly now: DateTime.Utc };

/** Claims pending work before posting, or reconciles an already uncertain attempt. */
export async function runSlackDelivery({ store, delivery, ...input }: RunSlackDeliveryInput): Promise<void> {
  const prepared = await prepareSlackDelivery({ store, delivery, ...input });

  if (Option.isNone(prepared)) {
    return;
  }

  const now = DateTime.nowUnsafe();
  const text = delivery.text.slice(0, SLACK_REPLY_MAX_CHARS).toWellFormed();
  const contentSha256 = await sha256Hex({ text });
  const work = { store, delivery, ...prepared.value, contentSha256, now };

  if (delivery.status === SlackDeliveryStatus.Uncertain) {
    return await reconcileStoredSlackDelivery(work);
  }

  return await postStoredSlackDelivery({ ...work, text });
}

async function postStoredSlackDelivery({
  store,
  delivery,
  installation,
  destination,
  botToken,
  text,
  contentSha256,
  now,
}: PostStoredSlackDeliveryInput): Promise<void> {
  const nextAttemptAt = DateTime.addDuration(now, SLACK_FIRST_RECONCILIATION_DELAY);
  const intent = { deliveryId: delivery.id, contentSha256, now, nextAttemptAt };
  const claim = await store.atomic({ run: (tables) => tables.beginSlackDelivery(intent) });

  if (!SlackDeliveryClaim.guards.Claimed(claim)) {
    return;
  }

  const result = await postSlackDelivery({
    installation,
    token: botToken,
    destination,
    deliveryId: delivery.id,
    text,
    contentSha256,
  });

  await settleSlackPost({ store, delivery, result, now });
}
