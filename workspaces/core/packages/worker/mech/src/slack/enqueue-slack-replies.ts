import { SLACK_REPLY_MAX_CHARS } from '@mechane/integrations';
import type { MechTables } from '@mechane/mech-store';
import { InboxItemId, SlackDeliveryId } from '@mechane/records';
import type { TurnId } from '@mechane/records';
import { Option } from 'effect';
import type { DateTime } from 'effect';

type EnqueueSlackRepliesInput = {
  readonly store: MechTables;
  readonly turnId: TurnId;
  readonly reply: string;
  readonly now: DateTime.Utc;
};

/** Adds reply intents in the same transaction that projects a successful inbox answer. */
export function enqueueSlackReplies({ store, turnId, reply, now }: EnqueueSlackRepliesInput): void {
  const text = reply.slice(0, SLACK_REPLY_MAX_CHARS).toWellFormed();

  if (text.length === 0) {
    return;
  }

  for (const itemId of store.turnInboxItemIds({ turnId })) {
    const inboxItemId = InboxItemId.make(itemId);
    const origin = store.slackInboxOrigin({ inboxItemId });

    if (Option.isSome(origin)) {
      const deliveryId = SlackDeliveryId.make(inboxItemId);

      store.enqueueSlackDelivery({ deliveryId, destination: origin.value.destination, text, now });
    }
  }
}
