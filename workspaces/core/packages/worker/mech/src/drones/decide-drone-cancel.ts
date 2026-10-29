import type { MechTables } from '@mechane/mech-store';
import { DroneCancelAnswer } from '@mechane/rpc';
import { Option } from 'effect';
import type { DateTime } from 'effect';
import type { AlarmDecision } from '../types.ts';

/** A cancel of a drone by a member, decided at the time of the call. */
type DroneCancelInput = {
  readonly store: MechTables;
  readonly droneId: string;
  readonly cancelerId: string;
  readonly now: DateTime.Utc;
};

/**
 * Decides a member's cancel of a drone in one transaction: a running drone is canceled now, and a canceled one answers
 * its first cancel, so a retry finds it. An ended drone answers that it ended. Only the alarm stops a drone's work, so
 * the decision says whether the alarm has a drone to stop.
 */
export function decideDroneCancel({
  store,
  droneId,
  cancelerId,
  now,
}: DroneCancelInput): AlarmDecision<DroneCancelAnswer> {
  if (Option.isNone(store.mech())) {
    return { answer: DroneCancelAnswer.cases.MechMissing.make({}), isAlarmDue: false };
  }

  if (Option.isNone(store.drone({ droneId }))) {
    return { answer: DroneCancelAnswer.cases.DroneMissing.make({}), isAlarmDue: false };
  }

  store.cancelDrone({ droneId, cancelerId, now });

  const cancel = store.droneCancel({ droneId });

  if (Option.isNone(cancel)) {
    return { answer: DroneCancelAnswer.cases.Ended.make({}), isAlarmDue: false };
  }

  return { answer: DroneCancelAnswer.cases.Canceled.make(cancel.value), isAlarmDue: true };
}
