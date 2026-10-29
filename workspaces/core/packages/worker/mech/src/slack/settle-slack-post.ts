import { SlackPostResult } from '@mechane/integrations';
import type { UpdateSlackDeliveryInput } from '@mechane/mech-store';
import { SlackDeliveryStatus } from '@mechane/records';
import { DateTime, Option } from 'effect';
import { SLACK_FIRST_RECONCILIATION_DELAY } from './constants.ts';
import type { RunSlackDeliveryInput } from './types.ts';

type SettleSlackPostInput = Pick<RunSlackDeliveryInput, 'store' | 'delivery'> & {
  readonly result: SlackPostResult;
  readonly now: DateTime.Utc;
};

type SlackPostSettlementInput = Pick<SettleSlackPostInput, 'result' | 'now'>;
type SlackPostSettlement = Omit<UpdateSlackDeliveryInput, 'deliveryId' | 'reconciliationCount'>;

/** Persists a response classification and its next recovery deadline. */
export async function settleSlackPost({ store, delivery, result, now }: SettleSlackPostInput): Promise<void> {
  const settlement = slackPostSettlement({ result, now });
  const update = { deliveryId: delivery.id, reconciliationCount: delivery.reconciliationCount, ...settlement };

  await store.atomic({ run: (tables) => tables.updateSlackDelivery(update) });
}

function slackPostSettlement({ result, now }: SlackPostSettlementInput): SlackPostSettlement {
  const empty = { nextAttemptAt: Option.none(), messageTimestamp: Option.none(), lastError: Option.none() };

  if (SlackPostResult.guards.Sent(result)) {
    return { ...empty, status: SlackDeliveryStatus.Sent, messageTimestamp: Option.some(result.messageTimestamp) };
  }

  if (SlackPostResult.guards.Blocked(result)) {
    return { ...empty, status: SlackDeliveryStatus.Blocked, lastError: Option.some(result.reason) };
  }

  if (SlackPostResult.guards.Deferred(result)) {
    const deadline = DateTime.addDuration(now, result.retryAfter);

    return {
      ...empty,
      status: SlackDeliveryStatus.Pending,
      nextAttemptAt: Option.some(deadline),
      lastError: Option.some('rate_limited'),
    };
  }

  const deadline = DateTime.addDuration(now, SLACK_FIRST_RECONCILIATION_DELAY);

  return {
    ...empty,
    status: SlackDeliveryStatus.Uncertain,
    nextAttemptAt: Option.some(deadline),
    lastError: Option.some(result.reason),
  };
}
