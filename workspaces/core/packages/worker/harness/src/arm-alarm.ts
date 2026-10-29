import { Array, DateTime, Option } from 'effect';
import type { ArmAlarmInput } from './types.ts';

/**
 * Arms the object's one alarm for what the mech needs next: now while pi or the caller has work that can run, and never
 * later than pi's earliest sleep. With neither, it clears the alarm, so an idle mech is never woken.
 */
export async function armAlarm({ alarm, wake, isDue }: ArmAlarmInput): Promise<void> {
  const now = DateTime.nowUnsafe();

  const times = Array.getSomes([
    Option.liftPredicate(now, () => isDue || wake.active),
    Option.map(Option.fromNullishOr(wake.at), (atMs) => DateTime.makeUnsafe(atMs)),
  ]);

  if (!Array.isReadonlyArrayNonEmpty(times)) {
    return await alarm.disarm();
  }

  return await alarm.arm({
    at: Array.reduce(times, Array.headNonEmpty(times), (earliest, time) => DateTime.min(earliest, time)),
  });
}
