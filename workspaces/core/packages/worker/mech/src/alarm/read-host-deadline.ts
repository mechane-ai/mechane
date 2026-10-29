import { DateTime, Option } from 'effect';
import type { TablesInput } from '../types.ts';

/** Reads the earliest watch, check timeout, or Slack delivery deadline. */
export function readHostDeadline({ store }: TablesInput): Option.Option<DateTime.Utc> {
  const watch = store.nextWatchAt();
  const delivery = store.nextSlackDeliveryAt();

  if (Option.isNone(watch)) {
    return delivery;
  }

  if (Option.isNone(delivery)) {
    return watch;
  }

  const earliest = DateTime.min(watch.value, delivery.value);

  return Option.some(earliest);
}
