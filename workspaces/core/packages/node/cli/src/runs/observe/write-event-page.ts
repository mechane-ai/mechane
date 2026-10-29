import type { ClientFailure } from '@mechane/client';
import type { ListedEvent } from '@mechane/protocol';
import { Array, Effect, Option } from 'effect';
import { eventLines } from './event-lines.ts';
import { listedEvents } from './listed-events.ts';
import type { EventPageInput } from './types.ts';

/** The events of a page, and the cursor after them, none once a listing's page says no more follow. */
type ListedEventPage = readonly [ReadonlyArray<ListedEvent>, Option.Option<number>];

/**
 * Lists the events after `after`, writes each as one record, and answers them with the cursor to list after next. The
 * cursor is none once a listing's page says no more follow, at the end of the log.
 */
export const writeEventPage = Effect.fn('writeEventPage')(function* ({
  after,
  isFollowing,
  write,
  ...listing
}: EventPageInput): Effect.fn.Return<ListedEventPage, ClientFailure> {
  const { events, hasMore } = yield* listedEvents({ ...listing, after });

  for (const event of events) {
    write({ result: { lines: eventLines({ event }), result: event } });
  }

  const next = Option.getOrElse(
    Option.map(Array.last(events), (last) => last.sequence),
    () => after,
  );

  return [events, Option.liftPredicate(next, () => isFollowing || hasMore)];
});
