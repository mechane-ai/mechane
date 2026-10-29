import { armAlarm } from './arm-alarm.ts';
import type { ArmAlarmInput, HarnessHandle, StopInput, WakeSignal } from './types.ts';

/** The opened Harness, the signal its wakes announce on, the alarm armed after its work, and what stops the work. */
type WorkUntilIdleInput = HarnessHandle & Pick<ArmAlarmInput, 'alarm'> & StopInput & { readonly wakes: WakeSignal };

/**
 * The alarm's work: lets pi work until nothing can run now, then arms the alarm for its earliest sleep, clearing it
 * when it has none. A stop ends the work first and arms nothing, since the alarm then hands pi to the next one.
 */
export async function workUntilIdle({ harness, wakes, alarm, stop }: WorkUntilIdleInput): Promise<boolean> {
  harness.resume();

  const isStopped = await wakes.untilIdle({ harness, stop });

  if (isStopped) {
    return true;
  }

  await armAlarm({ alarm, wake: harness.wake(), isDue: false });

  return false;
}
