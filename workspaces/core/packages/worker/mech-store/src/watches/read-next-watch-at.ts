import { MechStatus, TurnStatus, WatchStatus } from '@mechane/protocol';
import { decodeOne } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import type { DateTime, Option } from 'effect';
import { Schema } from 'effect';

/** The earliest pending watch or running-check deadline read from storage. */
const WatchTimeRow = Schema.Struct({
  /** Absent when no active schedule or uncanceled running check needs a wake. */
  at: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
});

type WatchTimeRow = typeof WatchTimeRow.Type;

/** Reads the earliest active schedule or uncanceled running-check deadline. */
export function readNextWatchAt({ sql }: RecordsInput): Option.Option<DateTime.Utc> {
  const cursor = sql.exec(
    'SELECT MIN(at) AS at FROM (SELECT next_run_at_ms AS at FROM watches WHERE status = ? AND EXISTS (SELECT 1 FROM mech WHERE status = ?) UNION ALL SELECT turns.started_at_ms + watch_checks.max_check_seconds * 1000 AS at FROM watch_checks JOIN inbox_items ON inbox_items.id = watch_checks.inbox_item_id JOIN turns ON turns.id = inbox_items.turn_id WHERE turns.status = ? AND turns.canceled_at_ms IS NULL)',
    WatchStatus.Active,
    MechStatus.Active,
    TurnStatus.Running,
  );

  return decodeOne({ cursor, schema: WatchTimeRow }).at;
}
