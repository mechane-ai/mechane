import type { RowsPage } from '@mechane/store';
import { DateTime, Duration, Option } from 'effect';
import type { AwaitEventsInput } from './types.ts';

/**
 * The page of stored events after `after`; while the log holds none after it, the read waits for a write's signal until
 * the deadline. Each read registers its wait first, so no append between the read and the wait is missed.
 */
export async function awaitEvents({ store, signal, after, deadline }: AwaitEventsInput): Promise<RowsPage<string>> {
  let page: Option.Option<RowsPage<string>> = Option.none();

  while (Option.isNone(page)) {
    page = await readOrWait({ store, signal, after, deadline });
  }

  return page.value;
}

/**
 * One read of the events after `after`: the page once it holds events or the deadline passed. Else it answers none once
 * a write's signal or the timeout released the wait it registered first.
 */
async function readOrWait({
  store,
  signal,
  after,
  deadline,
}: AwaitEventsInput): Promise<Option.Option<RowsPage<string>>> {
  const timeout = Duration.max(DateTime.distance(DateTime.nowUnsafe(), deadline), Duration.zero);
  const waiter = signal.wait({ timeout: Option.some(timeout), stop: Option.none() });
  const page = await store.atomic({ run: (tables) => tables.eventsAfter({ after }) });

  if (page.rows.length > 0 || DateTime.isGreaterThanOrEqualTo(DateTime.nowUnsafe(), deadline)) {
    waiter.cancel();

    return Option.some(page);
  }

  await waiter.ended;

  return Option.none();
}
