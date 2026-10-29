import type { MechTables } from '@mechane/mech-store';
import { Delivery } from '@mechane/protocol';
import type { InboxItemId } from '@mechane/records';
import { SlackInboxOrigin } from '@mechane/records';
import { InboxItemReceipt } from '@mechane/rpc';
import { Option, Schema } from 'effect';
import type { DateTime } from 'effect';
import { decideInboxItemReceipt } from '../inbox/decide-inbox-item-receipt.ts';
import type { AlarmDecision } from '../types.ts';

type ReceiveSlackItemInput = {
  readonly store: MechTables;
  readonly inboxItemId: InboxItemId;
  readonly text: string;
  readonly origin: SlackInboxOrigin;
  readonly now: DateTime.Utc;
};

type SlackOriginConflictInput = Pick<ReceiveSlackItemInput, 'store' | 'inboxItemId' | 'origin'>;

/** Atomically records a verified origin with its idempotent inbox admission. */
export function receiveSlackItem({
  store,
  inboxItemId,
  text,
  origin,
  now,
}: ReceiveSlackItemInput): AlarmDecision<InboxItemReceipt> {
  if (isSlackOriginConflict({ store, inboxItemId, origin })) {
    return { answer: InboxItemReceipt.cases.Conflicting.make({}), isAlarmDue: false };
  }

  const decision = decideInboxItemReceipt({
    store,
    inboxItemId,
    text,
    delivery: Delivery.WhenIdle,
    senderId: origin.destination.bindingId,
    now,
  });

  if (InboxItemReceipt.guards.Received(decision.answer)) {
    store.recordSlackInboxOrigin({ inboxItemId, origin });
  }

  return decision;
}

function isSlackOriginConflict({ store, inboxItemId, origin }: SlackOriginConflictInput): boolean {
  const existing = store.slackInboxOrigin({ inboxItemId });

  if (Option.isNone(existing)) {
    const inboxItem = store.inboxItem({ inboxItemId });

    return Option.isSome(inboxItem);
  }

  const wire = Schema.fromJsonString(SlackInboxOrigin);
  const serialized = Schema.encodeSync(wire)(origin);
  const original = Schema.encodeSync(wire)(existing.value);

  return serialized !== original;
}
