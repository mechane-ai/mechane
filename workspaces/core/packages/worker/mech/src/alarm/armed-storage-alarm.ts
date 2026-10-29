import { mechAlarm } from '@mechane/mech-store';
import type { MechAlarm } from '@mechane/mech-store';
import { DateTime } from 'effect';
import { HEARTBEAT } from './constants.ts';

type ArmedStorageAlarmInput = { readonly storage: DurableObjectStorage };

/** Arms a fallback wake before opening storage or the harness can fail. */
export async function armedStorageAlarm({ storage }: ArmedStorageAlarmInput): Promise<MechAlarm> {
  const alarm = mechAlarm({ storage });
  const now = DateTime.nowUnsafe();
  const at = DateTime.addDuration(now, HEARTBEAT);

  await alarm.armBy({ at });

  return alarm;
}
