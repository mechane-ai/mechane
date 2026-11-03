import { DateTime, Option } from 'effect';
import type { TablesInput } from '../types.ts';

type EarliestInput = {
  /** None when this owner has no scheduled work. */
  readonly left: Option.Option<DateTime.Utc>;
  /** None when this owner has no scheduled work. */
  readonly right: Option.Option<DateTime.Utc>;
};

/** Reads the earliest watch, check timeout, or Slack delivery deadline. */
export function readHostDeadline({ store }: TablesInput): Option.Option<DateTime.Utc> {
  const watch = store.nextWatchAt();
  const delivery = store.nextSlackDeliveryAt();
  const bounded = store.nextBoundedTurnAt();
  const scheduled = earliestDeadline({ left: watch, right: delivery });

  return earliestDeadline({ left: scheduled, right: bounded });
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
