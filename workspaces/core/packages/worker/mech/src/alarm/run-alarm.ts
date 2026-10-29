import { writeLog } from '@mechane/logs';
import type { MechTables } from '@mechane/mech-store';
import { LogEvent } from '@mechane/protocol';
import { settlesWithin, untilAborted } from '@mechane/utilities';
import { DateTime, Duration, Option } from 'effect';
import { runSlackDeliveries } from '../slack/run-slack-deliveries.ts';
import type { MechHandle } from '../types.ts';
import { catchUp } from './catch-up.ts';
import { HEARTBEAT } from './constants.ts';
import { driveMech } from './drive-mech.ts';

/** The object's hold on its open mech, which its alarm drives and hands on. */
type RunAlarmInput = { readonly handle: MechHandle };

/**
 * How long past its work seconds an alarm holds new dispatches and waits for the open ones to settle before it closes
 * pi anyway. Three minutes keep the last two of the fifteen Cloudflare gives an alarm for the close and the reopen.
 * Nothing bounds a stream once the upstream answers, so a longer one is cut and charged its reservation.
 */
const ALARM_DRAIN = Duration.minutes(3);

/**
 * Runs the alarm: it arms the heartbeat before any work, so an alarm cut off is started again, and lets pi work for at
 * most the alarm's work seconds. Past them it drains the meter, closes pi, which counts no restart and rejoins each
 * command, and opens it again, which arms the next alarm for now. A drain that started always hands pi on, even once pi
 * went idle, so no dispatch it holds waits for another alarm's budget.
 */
export async function runAlarm({ handle }: RunAlarmInput): Promise<void> {
  const start = DateTime.nowUnsafe();
  const mech = await handle.current();
  const armed = DateTime.nowUnsafe();

  await mech.alarm.arm({ at: DateTime.addDuration(armed, HEARTBEAT) });
  await runSlackDeliveries(mech);

  const caught = await catchUp(mech);
  const workEnd = DateTime.addDuration(start, Duration.seconds(mech.settings.alarmWorkSeconds));
  const handOff = new AbortController();
  const driving = driveMech({ ...mech, caught, stop: untilAborted({ signal: handOff.signal }) });
  const isDriven = await settlesWithin({ promise: driving, span: DateTime.distance(DateTime.nowUnsafe(), workEnd) });

  if (isDriven) {
    return;
  }

  // pi works on while the drain holds every later dispatch and the open ones close; the stop then ends its work.
  const openDispatches = await mech.meter.drain({ deadline: DateTime.addDuration(workEnd, ALARM_DRAIN) });

  handOff.abort();
  await driving;

  const mechIdOf: (tables: MechTables) => Option.Option<string> = (tables) => Option.map(tables.mech(), ({ id }) => id);
  const mechId = await mech.store.atomic({ run: mechIdOf });

  writeLog({ line: { event: LogEvent.AlarmHandedOff, mechId, openDispatches } });
  await handle.reopen();
}
