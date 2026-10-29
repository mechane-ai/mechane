import { TurnStatus, WatchCheckOutcome } from '@mechane/protocol';
import { decodeRows } from '@mechane/store';
import type { SqlCall } from '@mechane/store';
import { DateTime } from 'effect';
import { ExpiredWatchCheck } from './watch.schemas.ts';
import type { WatchNowInput } from './watch.types.ts';

/** Marks expired checks unknown and returns the turns that still need cancellation. */
export function expiredWatchChecks({ sql, now }: SqlCall<WatchNowInput>): ReadonlyArray<ExpiredWatchCheck> {
  const nowMs = DateTime.toEpochMillis(now);

  const cursor = sql.exec(
    'SELECT watch_checks.watch_id, watch_checks.inbox_item_id, turns.id AS turn_id, watches.creator_id FROM watch_checks JOIN watches ON watches.id = watch_checks.watch_id JOIN inbox_items ON inbox_items.id = watch_checks.inbox_item_id JOIN turns ON turns.id = inbox_items.turn_id WHERE turns.status = ? AND turns.canceled_at_ms IS NULL AND turns.started_at_ms + watch_checks.max_check_seconds * 1000 <= ?',
    TurnStatus.Running,
    nowMs,
  );

  const expired = decodeRows({ cursor, schema: ExpiredWatchCheck });

  for (const check of expired) {
    sql.exec(
      'UPDATE watches SET last_check_outcome = ?, last_checked_at_ms = ? WHERE id = ?',
      WatchCheckOutcome.Unknown,
      nowMs,
      check.watchId,
    );
  }

  return expired;
}
