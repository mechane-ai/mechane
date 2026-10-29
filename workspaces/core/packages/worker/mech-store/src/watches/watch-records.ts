import { TurnStatus, WatchStatus } from '@mechane/protocol';
import type { WatchCheckSeconds } from '@mechane/protocol';
import type { InboxItemId } from '@mechane/records';
import { decodeFirst, decodeRows, rowCount } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { DateTime, Schema } from 'effect';
import type { Option } from 'effect';
import type { PendingItemRow } from '../schemas.ts';
import { WatchRow } from '../watch.schemas.ts';
import type { WatchIdInput } from '../watch.types.ts';
import { expiredWatchChecks } from './expired-watch-checks.ts';
import { readNextWatchAt } from './read-next-watch-at.ts';
import { settleWatchChecks } from './settle-watch-checks.ts';
import type { ExpiredWatchCheck } from './watch.schemas.ts';
import type { WatchNowInput } from './watch.types.ts';

type WatchInboxInput = { readonly inboxItemId: PendingItemRow['id'] };

type SetWatchRowInput = { readonly watch: WatchRow };

type AdvanceWatchInput = WatchIdInput & { readonly nextRunAt: DateTime.Utc };

type RecordWatchCheckInput = WatchIdInput &
  WatchNowInput & { readonly inboxItemId: InboxItemId; readonly maxCheckSeconds: WatchCheckSeconds };

type SetWatchStatusInput = WatchIdInput & WatchNowInput & { readonly status: WatchStatus };

/** The record operations inferred from the watch store factory. */
export type WatchRecords = ReturnType<typeof watchRecords>;

/** Reads and writes durable schedules and their admitted inbox checks. */
export function watchRecords({ sql }: RecordsInput) {
  return {
    watch: (input: WatchIdInput): Option.Option<WatchRow> => readWatch({ sql, ...input }),
    watchForInboxItem: (input: WatchInboxInput): Option.Option<WatchRow> => watchForInboxItem({ sql, ...input }),
    watches: (): ReadonlyArray<WatchRow> => readWatches({ sql }),
    setWatch: (input: SetWatchRowInput): void => setWatch({ sql, ...input }),
    setWatchStatus: (input: SetWatchStatusInput): void => setWatchStatus({ sql, ...input }),
    dueWatches: (input: WatchNowInput): ReadonlyArray<WatchRow> => readDueWatches({ sql, ...input }),
    advanceWatch: (input: AdvanceWatchInput): void => advanceWatch({ sql, ...input }),
    recordWatchCheck: (input: RecordWatchCheckInput): void => recordWatchCheck({ sql, ...input }),
    unfinishedWatchCheckCount: (input: WatchIdInput): number => unfinishedWatchCheckCount({ sql, ...input }),
    runningWatchCheckCount: (input: WatchIdInput & WatchNowInput): number => runningWatchCheckCount({ sql, ...input }),
    nextWatchAt: (): Option.Option<DateTime.Utc> => readNextWatchAt({ sql }),
    expiredWatchChecks: (input: WatchNowInput): ReadonlyArray<ExpiredWatchCheck> =>
      expiredWatchChecks({ sql, ...input }),
    settleWatchChecks: (): void => settleWatchChecks({ sql }),
  };
}

function readWatch({ sql, watchId }: SqlCall<WatchIdInput>): Option.Option<WatchRow> {
  const cursor = sql.exec('SELECT * FROM watches WHERE id = ?', watchId);

  return decodeFirst({ cursor, schema: WatchRow });
}

function readWatches({ sql }: RecordsInput): ReadonlyArray<WatchRow> {
  const cursor = sql.exec('SELECT * FROM watches ORDER BY created_at_ms, id');

  return decodeRows({ cursor, schema: WatchRow });
}

function watchForInboxItem({ sql, inboxItemId }: SqlCall<WatchInboxInput>): Option.Option<WatchRow> {
  const cursor = sql.exec(
    'SELECT watches.* FROM watches JOIN watch_checks ON watch_checks.watch_id = watches.id WHERE watch_checks.inbox_item_id = ?',
    inboxItemId,
  );

  return decodeFirst({ cursor, schema: WatchRow });
}

function setWatch({ sql, watch }: SqlCall<SetWatchRowInput>): void {
  const row = Schema.encodeSync(WatchRow)(watch);

  sql.exec(
    'INSERT INTO watches (id, name, prompt, interval_seconds, status, notification_binding_id, cooldown_seconds, max_check_seconds, next_run_at_ms, creator_id, created_at_ms, updated_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET name = excluded.name, prompt = excluded.prompt, interval_seconds = excluded.interval_seconds, status = excluded.status, notification_binding_id = excluded.notification_binding_id, cooldown_seconds = excluded.cooldown_seconds, max_check_seconds = excluded.max_check_seconds, next_run_at_ms = excluded.next_run_at_ms, updated_at_ms = excluded.updated_at_ms',
    row.id,
    row.name,
    row.prompt,
    row.interval_seconds,
    row.status,
    row.notification_binding_id,
    row.cooldown_seconds,
    row.max_check_seconds,
    row.next_run_at_ms,
    row.creator_id,
    row.created_at_ms,
    row.updated_at_ms,
  );
}

function setWatchStatus({ sql, watchId, status, now }: SqlCall<SetWatchStatusInput>): void {
  const nowMs = DateTime.toEpochMillis(now);

  sql.exec('UPDATE watches SET status = ?, updated_at_ms = ? WHERE id = ?', status, nowMs, watchId);
}

function readDueWatches({ sql, now }: SqlCall<WatchNowInput>): ReadonlyArray<WatchRow> {
  const nowMs = DateTime.toEpochMillis(now);

  const cursor = sql.exec(
    'SELECT * FROM watches WHERE status = ? AND next_run_at_ms <= ? ORDER BY next_run_at_ms, id',
    WatchStatus.Active,
    nowMs,
  );

  return decodeRows({ cursor, schema: WatchRow });
}

function advanceWatch({ sql, watchId, nextRunAt }: SqlCall<AdvanceWatchInput>): void {
  const nextRunAtMs = DateTime.toEpochMillis(nextRunAt);

  sql.exec('UPDATE watches SET next_run_at_ms = ? WHERE id = ?', nextRunAtMs, watchId);
}

function recordWatchCheck({ sql, watchId, inboxItemId, maxCheckSeconds, now }: SqlCall<RecordWatchCheckInput>): void {
  const nowMs = DateTime.toEpochMillis(now);

  sql.exec(
    'INSERT INTO watch_checks (inbox_item_id, watch_id, scheduled_at_ms, max_check_seconds) VALUES (?, ?, ?, ?)',
    inboxItemId,
    watchId,
    nowMs,
    maxCheckSeconds,
  );
}

function unfinishedWatchCheckCount({ sql, watchId }: SqlCall<WatchIdInput>): number {
  const cursor = sql.exec(
    'SELECT COUNT(*) AS count FROM watch_checks JOIN inbox_items ON inbox_items.id = watch_checks.inbox_item_id LEFT JOIN turns ON turns.id = inbox_items.turn_id WHERE watch_checks.watch_id = ? AND (inbox_items.turn_id IS NULL OR turns.status = ?)',
    watchId,
    TurnStatus.Running,
  );

  return rowCount({ cursor });
}

function runningWatchCheckCount({ sql, watchId, now }: SqlCall<WatchIdInput & WatchNowInput>): number {
  const nowMs = DateTime.toEpochMillis(now);

  const cursor = sql.exec(
    'SELECT COUNT(*) AS count FROM watch_checks JOIN inbox_items ON inbox_items.id = watch_checks.inbox_item_id JOIN turns ON turns.id = inbox_items.turn_id WHERE watch_checks.watch_id = ? AND turns.status = ? AND turns.canceled_at_ms IS NULL AND turns.started_at_ms + watch_checks.max_check_seconds * 1000 > ?',
    watchId,
    TurnStatus.Running,
    nowMs,
  );

  return rowCount({ cursor });
}
