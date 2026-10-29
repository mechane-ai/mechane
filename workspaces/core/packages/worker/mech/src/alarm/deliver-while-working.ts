import { settlesWithin } from '@mechane/utilities';
import { DateTime, Duration, Option } from 'effect';
import { runSlackDeliveries } from '../slack/run-slack-deliveries.ts';
import type { OpenedMech } from '../types.ts';
import { applyCatchUp } from './apply-catch-up.ts';
import { catchUp } from './catch-up.ts';
import { readHostDeadline } from './read-host-deadline.ts';

/** The open mech, and the alarm's work on it, which settles once pi has nothing it can run or a stop came. */
type DeliverWhileWorkingInput = { readonly mech: OpenedMech; readonly working: Promise<boolean> };

/** Whether the work has settled, and whether any poll so far applied work. */
type Poll = { readonly isDone: boolean; readonly hasApplied: boolean };

/** The open mech, its work, and whether a poll before this one applied work. */
type PollInput = DeliverWhileWorkingInput & Pick<Poll, 'hasApplied'>;

/**
 * How often the alarm looks for items sent while pi works: often enough that an item sent for the next pause reaches pi
 * before a short tool round ends.
 */
const DELIVERY_POLL = Duration.millis(250);

/**
 * Waits for the work and answers whether any poll applied work; every poll interval applies what was recorded
 * meanwhile, such as a send, a cancel or a faulted turn's note. So an item for the next pause reaches the running turn,
 * and a cancel stops it. Only the alarm's own timer wakes the check, so each application runs in the alarm's event,
 * never in a send's.
 */
export async function deliverWhileWorking({ mech, working }: DeliverWhileWorkingInput): Promise<boolean> {
  let poll: Poll = { isDone: false, hasApplied: false };

  while (!poll.isDone) {
    poll = await pollOnce({ mech, working, hasApplied: poll.hasApplied });
  }

  return poll.hasApplied;
}

/** Waits one poll interval for the work, then applies what was marked meanwhile, if the work still runs. */
async function pollOnce({ mech, working, hasApplied }: PollInput): Promise<Poll> {
  const isDone = await settlesWithin({ promise: working, span: DELIVERY_POLL });

  if (isDone) {
    return { isDone, hasApplied };
  }

  const deadline = await mech.store.atomic({ run: (store) => readHostDeadline({ store }) });
  const now = DateTime.nowUnsafe();
  const isPast: (at: DateTime.Utc) => boolean = (at) => DateTime.isLessThanOrEqualTo(at, now);
  const isDue = Option.exists(deadline, isPast);
  const isRecorded = mech.recorded.take();

  if (!isDue && !isRecorded) {
    return { isDone, hasApplied };
  }

  await runSlackDeliveries(mech);

  const caught = await catchUp(mech);

  await applyCatchUp({ mech, caught });

  return { isDone, hasApplied: true };
}
