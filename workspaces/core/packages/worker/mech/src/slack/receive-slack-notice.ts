import type { MechTables } from '@mechane/mech-store';
import type { SlackDestination } from '@mechane/records';
import { SlackNoticeReceipt } from '@mechane/rpc';
import { Option } from 'effect';
import type { DateTime } from 'effect';
import type { AlarmDecision } from '../types.ts';

type ReceiveSlackNoticeInput = {
  readonly store: MechTables;
  readonly noticeKey: string;
  readonly destination: SlackDestination;
  readonly text: string;
  readonly now: DateTime.Utc;
};

/** Records one visible intake outcome without submitting unsupported input to the model. */
export function receiveSlackNotice({ store, ...notice }: ReceiveSlackNoticeInput): AlarmDecision<SlackNoticeReceipt> {
  const mech = store.mech();

  if (Option.isNone(mech)) {
    return { answer: SlackNoticeReceipt.cases.MechMissing.make({}), isAlarmDue: false };
  }

  store.enqueueSlackNotice(notice);

  return { answer: SlackNoticeReceipt.cases.Received.make({}), isAlarmDue: true };
}
