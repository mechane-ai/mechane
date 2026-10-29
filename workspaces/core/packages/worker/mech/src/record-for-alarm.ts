import type { MechTables } from '@mechane/mech-store';
import { DateTime } from 'effect';
import type { AlarmDecision, OpenedMech } from './types.ts';

/** The open mech a decision runs on, and the decision. */
type RecordForAlarmInput<A> = {
  readonly opened: Promise<OpenedMech>;
  readonly run: (tables: MechTables) => AlarmDecision<A>;
};

/**
 * Decides in one transaction and wakes the waiting lists of events, then marks and arms the alarm for now when the
 * decision left it work, and answers the decision's answer.
 */
export async function recordForAlarm<A>({ opened, run }: RecordForAlarmInput<A>): Promise<A> {
  const { store, alarm, signal, recorded } = await opened;
  const { answer, isAlarmDue } = await store.atomic({ run });

  signal.wake();

  if (isAlarmDue) {
    recorded.mark();
    await alarm.armBy({ at: DateTime.nowUnsafe() });
  }

  return answer;
}
