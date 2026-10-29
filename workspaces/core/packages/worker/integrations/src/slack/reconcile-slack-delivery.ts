import { Number, Option } from 'effect';
import { findSlackDeliveryMessage } from './find-slack-delivery-message.ts';
import { readSlackHistoryPage } from './read-slack-history-page.ts';
import type { ReconcileSlackDeliveryInput, SlackReconciliation } from './types.ts';

const SLACK_HISTORY_MAX_PAGES = 10;

/** Absence is inconclusive: Slack may still commit an uncertain write, or its history may hide the message. */
export async function reconcileSlackDelivery({ ...input }: ReconcileSlackDeliveryInput): Promise<SlackReconciliation> {
  let cursor = '';

  for (let page = 0; page < SLACK_HISTORY_MAX_PAGES; page = Number.sum(page, 1)) {
    const response = await readSlackHistoryPage({ ...input, cursor });

    if (Option.isNone(response) || !response.value.isOk) {
      return { messageTimestamp: Option.none(), reason: 'history_unavailable' };
    }

    const messageTimestamp = findSlackDeliveryMessage({ ...input, history: response.value });

    if (Option.isSome(messageTimestamp)) {
      return { messageTimestamp, reason: 'matched_metadata' };
    }

    const next = Option.flatMap(response.value.response_metadata, (value) => value.next_cursor);

    cursor = Option.getOrElse(next, () => '');

    if (cursor.length === 0) {
      return { messageTimestamp: Option.none(), reason: 'not_observed' };
    }
  }

  return { messageTimestamp: Option.none(), reason: 'history_page_limit' };
}
