import { DateTime, Option } from 'effect';
import { readContinuationOwner } from '../threads/read-continuation-owner.ts';
import type { TablesInput } from '../types.ts';

type EarliestInput = {
  /** None when this owner has no scheduled work. */
  readonly left: Option.Option<DateTime.Utc>;
  /** None when this owner has no scheduled work. */
  readonly right: Option.Option<DateTime.Utc>;
};

/** Reads the earliest host deadline, admitting work continuations only when their owner is idle. */
export function readHostDeadline({ store }: TablesInput): Option.Option<DateTime.Utc> {
  const watch = store.nextWatchAt();
  const delivery = store.nextSlackDeliveryAt();
  const bounded = store.nextBoundedTurnAt();
  const scheduled = earliestDeadline({ left: watch, right: delivery });

  const idle = readContinuationOwner({ store });
  const continuation = Option.flatMap(idle, () => store.nextThreadContinuationAt());
  const request = Option.flatMap(idle, () => store.nextRequestWaitAt());
  const resumed = earliestDeadline({ left: continuation, right: request });

  const next = earliestDeadline({ left: scheduled, right: bounded });

  return earliestDeadline({ left: next, right: resumed });
}

function earliestDeadline({ left, right }: EarliestInput): Option.Option<DateTime.Utc> {
  if (Option.isNone(left)) {
    return right;
  }

  if (Option.isNone(right)) {
    return left;
  }

  const earliest = DateTime.min(left.value, right.value);

  return Option.some(earliest);
}
