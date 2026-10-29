import type { MechTables } from '@mechane/mech-store';
import { Delivery, EventType, MechStatus } from '@mechane/protocol';
import { InboxItemReceipt } from '@mechane/rpc';
import { Option } from 'effect';
import type { DateTime } from 'effect';
import { recordTurnCancel } from '../turns/record-turn-cancel.ts';
import type { AlarmDecision } from '../types.ts';

/** The item a member sends, decided at the time of the call: its id, its text, how it reaches the mech, its sender. */
type InboxItemReceiptInput = {
  readonly store: MechTables;
  readonly inboxItemId: string;
  readonly text: string;
  readonly delivery: Delivery;
  readonly senderId: string;
  readonly now: DateTime.Utc;
};

/**
 * Records an inbox item and its event before pi is called, and answers whether the alarm has an item to deliver. A
 * retry with the same text and delivery finds the item, which pi admits once; another text or delivery under its id
 * conflicts, since pi compares only a submission's kind. A new interrupt cancels, by its sender, the turn running at
 * its receipt, and a retry cancels nothing, so a later turn keeps running.
 */
export function decideInboxItemReceipt({
  store,
  inboxItemId,
  text,
  delivery,
  senderId,
  now,
}: InboxItemReceiptInput): AlarmDecision<InboxItemReceipt> {
  const mech = store.mech();
  const existing = store.inboxItem({ inboxItemId });

  if (Option.isNone(mech)) {
    return { answer: InboxItemReceipt.cases.MechMissing.make({}), isAlarmDue: false };
  }

  if (Option.isSome(existing)) {
    if (existing.value.text !== text || existing.value.delivery !== delivery) {
      return { answer: InboxItemReceipt.cases.Conflicting.make({}), isAlarmDue: false };
    }

    return { answer: InboxItemReceipt.cases.Received.make({ inboxItem: existing.value }), isAlarmDue: true };
  }

  if (mech.value.status === MechStatus.Archived) {
    return { answer: InboxItemReceipt.cases.Archived.make({}), isAlarmDue: false };
  }

  return recordInboxItem({ store, inboxItemId, text, delivery, senderId, now });
}

/** Records a new inbox item and its event, and an interrupt's cancel of the turn running at its receipt. */
function recordInboxItem({
  store,
  inboxItemId,
  text,
  delivery,
  senderId,
  now,
}: InboxItemReceiptInput): AlarmDecision<InboxItemReceipt> {
  const event = { type: EventType.InboxItemReceived, inboxItemId, senderId, text, delivery };
  const receivedSequence = store.appendEvent({ event, now });
  const inboxItem = { id: inboxItemId, text, delivery, senderId, receivedAt: now, receivedSequence };

  store.receiveInboxItem({ inboxItem });

  const running = store.runningTurn();

  if (delivery === Delivery.Interrupt && Option.isSome(running)) {
    recordTurnCancel({ store, turnId: running.value, cancelerId: senderId, now });
  }

  return { answer: InboxItemReceipt.cases.Received.make({ inboxItem }), isAlarmDue: true };
}
