import { TurnStatus, WatchCheckOutcome } from '@mechane/protocol';
import type { RecordsInput } from '@mechane/store';

/** Projects ended turns into watch outcomes once, without inventing evidence or recovery. */
export function settleWatchChecks({ sql }: RecordsInput): void {
  sql.exec(
    'UPDATE watches SET last_check_outcome = (SELECT CASE WHEN turns.status = ? THEN ? ELSE ? END FROM watch_checks JOIN inbox_items ON inbox_items.id = watch_checks.inbox_item_id JOIN turns ON turns.id = inbox_items.turn_id WHERE watch_checks.watch_id = watches.id AND watch_checks.settled_at_ms IS NULL AND turns.ended_at_ms IS NOT NULL ORDER BY turns.ended_at_ms DESC LIMIT 1), last_checked_at_ms = (SELECT MAX(turns.ended_at_ms) FROM watch_checks JOIN inbox_items ON inbox_items.id = watch_checks.inbox_item_id JOIN turns ON turns.id = inbox_items.turn_id WHERE watch_checks.watch_id = watches.id AND watch_checks.settled_at_ms IS NULL AND turns.ended_at_ms IS NOT NULL) WHERE EXISTS (SELECT 1 FROM watch_checks JOIN inbox_items ON inbox_items.id = watch_checks.inbox_item_id JOIN turns ON turns.id = inbox_items.turn_id WHERE watch_checks.watch_id = watches.id AND watch_checks.settled_at_ms IS NULL AND turns.ended_at_ms IS NOT NULL)',
    TurnStatus.Answered,
    WatchCheckOutcome.Completed,
    WatchCheckOutcome.Unknown,
  );
  sql.exec(
    'UPDATE watch_checks SET settled_at_ms = (SELECT turns.ended_at_ms FROM inbox_items JOIN turns ON turns.id = inbox_items.turn_id WHERE inbox_items.id = watch_checks.inbox_item_id) WHERE settled_at_ms IS NULL AND EXISTS (SELECT 1 FROM inbox_items JOIN turns ON turns.id = inbox_items.turn_id WHERE inbox_items.id = watch_checks.inbox_item_id AND turns.ended_at_ms IS NOT NULL)',
  );
}
