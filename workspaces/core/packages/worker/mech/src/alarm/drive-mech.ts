import type { StopInput } from '@mechane/harness';
import { DateTime, Option } from 'effect';
import { runSlackDeliveries } from '../slack/run-slack-deliveries.ts';
import type { OpenedMech } from '../types.ts';
import { applyCatchUp } from './apply-catch-up.ts';
import { catchUp } from './catch-up.ts';
import { HEARTBEAT } from './constants.ts';
import { deliverWhileWorking } from './deliver-while-working.ts';
import { isCaughtUp } from './is-caught-up.ts';
import type { CaughtUp, CaughtUpInput } from './types.ts';

/** The open mech, what the alarm owes it first, and the stop that ends its work. */
type DriveMechInput = OpenedMech & CaughtUpInput & StopInput;

/** The open mech, what the alarm owes it now, and the stop that ends its work. */
type DriveRoundInput = { readonly mech: OpenedMech; readonly caught: CaughtUp; readonly stop: Promise<unknown> };

/**
 * Applies what the alarm owes pi and lets pi work until nothing can run or `stop` settles, inside the alarm's event;
 * pi's work outlives any other call that starts it. Pi's work ends by arming the alarm for its next need, and then the
 * catch-up is read again, so a send or cancel recorded before that arm is applied here. One recorded later is applied
 * by the alarm its own arm sets.
 */
export async function driveMech({ caught, stop, ...mech }: DriveMechInput): Promise<void> {
  let next = Option.some(caught);

  while (Option.isSome(next)) {
    next = await driveRound({ mech, caught: next.value, stop });
  }
}

/**
 * One round of the alarm's work, which answers what the next round owes pi. A poll may have restarted pi just as its
 * work ended, so another round follows any poll that applied work. After a stop no round follows, and no catch-up is
 * read, since the alarm hands pi on.
 */
async function driveRound({ mech, caught, stop }: DriveRoundInput): Promise<Option.Option<CaughtUp>> {
  await applyCatchUp({ mech, caught });

  const working = mech.harness.work({ stop });
  const hasApplied = await deliverWhileWorking({ mech, working });
  const isStopped = await working;

  if (isStopped) {
    return Option.none();
  }

  const next = await catchUp(mech);

  await runSlackDeliveries(mech);

  if (!hasApplied && isCaughtUp({ caught: next })) {
    await mech.harness.armNext({ isDue: false });

    return Option.none();
  }

  await mech.alarm.arm({ at: DateTime.addDuration(DateTime.nowUnsafe(), HEARTBEAT) });

  return Option.some(next);
}
