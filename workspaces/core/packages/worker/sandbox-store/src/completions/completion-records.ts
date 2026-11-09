import { SandboxCompletionReceipt } from '@mechane/sandbox-wire';
import { decodeFirst, decodeRows } from '@mechane/store';
import type { RecordsInput } from '@mechane/store';
import { DateTime, Duration, Option, Schema } from 'effect';

const CompletionRow = Schema.Struct({ receipt: Schema.fromJsonString(SandboxCompletionReceipt) });
const IdleRow = Schema.Struct({ at: Schema.DateTimeUtcFromMillis });
const PRESENT_ROW_VALUE = 1;
const PresentRow = Schema.Struct({ present: Schema.Literal(PRESENT_ROW_VALUE) });
const FailureRow = Schema.Struct({ failures: Schema.Int });
const COMPLETION_BATCH_ROWS = 20;
const COMPLETION_BACKOFF_MAX_EXPONENT = 6;
const COMPLETION_BACKOFF_MULTIPLIER = 2;
const COMPLETION_RETRY_BASE = Duration.seconds(5);
const COMPLETION_RETRY_MAX = Duration.minutes(5);

/** Active work needs passive observation even when the agent is idle. */
export const BackgroundWork = Schema.TaggedUnion({ Active: {}, Idle: {} });
export type BackgroundWork = typeof BackgroundWork.Type;

type CompleteDeliveryInput = Pick<SandboxCompletionReceipt, 'executionId' | 'kind'>;
type IdleDeadlineInput = { readonly at: DateTime.Utc };
type NowInput = { readonly now: DateTime.Utc };
type FailedDeliveryInput = CompleteDeliveryInput & NowInput;
type ReceiptInput = Pick<SandboxCompletionReceipt, 'executionId'>;

/** Terminal transitions enqueue their receipt in the same SQLite statement that records the outcome. */
export function completionRecords({ sql }: RecordsInput) {
  function completionReceipt({ executionId }: ReceiptInput): Option.Option<SandboxCompletionReceipt> {
    const cursor = sql.exec('SELECT receipt FROM sandbox_completions WHERE execution_id = ?', executionId);
    const row = decodeFirst({ cursor, schema: CompletionRow });

    return Option.map(row, ({ receipt }) => receipt);
  }

  function pendingCompletions({ now }: NowInput): ReadonlyArray<SandboxCompletionReceipt> {
    const nowMs = DateTime.toEpochMillis(now);

    const cursor = sql.exec(
      'SELECT receipt FROM sandbox_completions WHERE is_delivered = 0 AND next_attempt_at_ms <= ? ORDER BY rowid LIMIT ?',
      nowMs,
      COMPLETION_BATCH_ROWS,
    );

    return decodeRows({ cursor, schema: CompletionRow }).map(({ receipt }) => receipt);
  }

  function completeDelivery({ executionId, kind }: CompleteDeliveryInput): void {
    sql.exec('UPDATE sandbox_completions SET is_delivered = 1 WHERE execution_id = ? AND kind = ?', executionId, kind);
  }

  function failCompletionDelivery({ executionId, kind, now }: FailedDeliveryInput): void {
    const cursor = sql.exec(
      'SELECT failures FROM sandbox_completions WHERE execution_id = ? AND kind = ? AND is_delivered = 0',
      executionId,
      kind,
    );

    const stored = decodeFirst({ cursor, schema: FailureRow });

    if (Option.isNone(stored)) {
      return;
    }

    const baseDelayMs = Duration.toMillis(COMPLETION_RETRY_BASE);
    const maxDelayMs = Duration.toMillis(COMPLETION_RETRY_MAX);
    const exponent = Math.min(stored.value.failures, COMPLETION_BACKOFF_MAX_EXPONENT);
    const delayMs = Math.min(baseDelayMs * COMPLETION_BACKOFF_MULTIPLIER ** exponent, maxDelayMs);
    const nowMs = DateTime.toEpochMillis(now);
    const nextAttemptAtMs = nowMs + delayMs;

    sql.exec(
      'UPDATE sandbox_completions SET failures = failures + 1, next_attempt_at_ms = ? WHERE execution_id = ? AND kind = ? AND is_delivered = 0',
      nextAttemptAtMs,
      executionId,
      kind,
    );
  }

  function nextCompletionAt(): Option.Option<DateTime.Utc> {
    const cursor = sql.exec(
      'SELECT next_attempt_at_ms AS at FROM sandbox_completions WHERE is_delivered = 0 ORDER BY next_attempt_at_ms LIMIT 1',
    );

    const row = decodeFirst({ cursor, schema: IdleRow });

    return Option.map(row, ({ at }) => at);
  }

  function backgroundWork(): BackgroundWork {
    const cursor = sql.exec(
      "SELECT 1 AS present WHERE EXISTS (SELECT 1 FROM executions WHERE status = 'dispatched') OR EXISTS (SELECT 1 FROM managed_processes WHERE machine_id IS NOT NULL AND (json_extract(record, '$.observation.state._tag') IS NULL OR json_extract(record, '$.observation.state._tag') = 'Running'))",
    );

    const row = decodeFirst({ cursor, schema: PresentRow });

    if (Option.isSome(row)) {
      return BackgroundWork.cases.Active.make({});
    }

    return BackgroundWork.cases.Idle.make({});
  }

  function sandboxIdleAt(): Option.Option<DateTime.Utc> {
    const cursor = sql.exec('SELECT idle_at_ms AS at FROM sandbox_activity WHERE idle_at_ms IS NOT NULL');
    const row = decodeFirst({ cursor, schema: IdleRow });

    return Option.map(row, ({ at }) => at);
  }

  function setSandboxIdleAt({ at }: IdleDeadlineInput): void {
    const atMs = DateTime.toEpochMillis(at);

    sql.exec('UPDATE sandbox_activity SET idle_at_ms = ? WHERE slot = 1', atMs);
  }

  function clearSandboxIdleAt(): void {
    sql.exec('UPDATE sandbox_activity SET idle_at_ms = NULL WHERE slot = 1');
  }

  return {
    completionReceipt,
    pendingCompletions,
    completeDelivery,
    failCompletionDelivery,
    nextCompletionAt,
    backgroundWork,
    sandboxIdleAt,
    setSandboxIdleAt,
    clearSandboxIdleAt,
  };
}
