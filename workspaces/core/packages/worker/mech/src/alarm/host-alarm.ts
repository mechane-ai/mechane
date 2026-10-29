import type { MechAlarm, MechStore } from '@mechane/mech-store';
import { DateTime, Option } from 'effect';
import { readHostDeadline } from './read-host-deadline.ts';

type HostAlarmInput = { readonly alarm: MechAlarm; readonly store: MechStore };

/** Preserves the earliest host deadline whenever the harness arms or clears its single alarm. */
export function hostAlarm({ alarm, store }: HostAlarmInput): MechAlarm {
  const arm: MechAlarm['arm'] = async ({ at }) => {
    const host = await store.atomic({ run: (tables) => readHostDeadline({ store: tables }) });
    const earliest = Option.match(host, { onNone: () => at, onSome: (deadline) => DateTime.min(at, deadline) });

    await alarm.arm({ at: earliest });
  };

  const disarm: MechAlarm['disarm'] = async () => {
    const host = await store.atomic({ run: (tables) => readHostDeadline({ store: tables }) });

    if (Option.isSome(host)) {
      return await alarm.arm({ at: host.value });
    }

    return await alarm.disarm();
  };

  return { arm, disarm, armBy: alarm.armBy };
}
