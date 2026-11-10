import type { MechTables } from '@mechane/mech-store';
import { Delivery, MechStatus } from '@mechane/protocol';
import type { InboxItemId } from '@mechane/records';
import { createSlackIntakeNoticeKey, SlackInboxOrigin } from '@mechane/records';
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
type ChooseSlackIntakeNoticeInput = { readonly isPaused: boolean };

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

  const existingOrigin = store.slackInboxOrigin({ inboxItemId });
  const isFirstAdmission = Option.isNone(existingOrigin);

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

    if (isFirstAdmission) {
      const mech = store.mech();
      const isPaused = Option.exists(mech, ({ status }) => status === MechStatus.Paused);
      const notice = chooseSlackIntakeNotice({ isPaused });
      const noticeKey = createSlackIntakeNoticeKey({ inboxItemId });

      store.enqueueSlackNotice({ noticeKey, destination: origin.destination, text: notice, now });
    }
  }

  return decision;
}

function chooseSlackIntakeNotice({ isPaused }: ChooseSlackIntakeNoticeInput): string {
  if (isPaused) {
    return 'Received. This mech is paused; your message is queued until it resumes.';
  }

  return "Received. I'll reply in this thread.";
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
