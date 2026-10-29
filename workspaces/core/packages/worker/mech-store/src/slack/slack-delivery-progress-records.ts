import { SlackDeliveryId, SlackDeliveryStatus } from '@mechane/records';
import { decodeFirst } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { DateTime, Option, Schema } from 'effect';
import { SlackDeliveryClaim } from './schemas.ts';
import type { UpdateSlackDeliveryInput } from './types.ts';

const SlackDeliveryIdRow = Schema.Struct({ id: SlackDeliveryId });

type SlackDeliveryIdRow = typeof SlackDeliveryIdRow.Type;

type BeginSlackDeliveryInput = {
  readonly deliveryId: SlackDeliveryId;
  readonly contentSha256: string;
  readonly now: DateTime.Utc;
  readonly nextAttemptAt: DateTime.Utc;
};

/** Atomic delivery claims and durable outcome transitions. */
export function slackDeliveryProgressRecords({ sql }: RecordsInput) {
  return {
    beginSlackDelivery: (input: BeginSlackDeliveryInput): SlackDeliveryClaim => beginSlackDelivery({ sql, ...input }),
    updateSlackDelivery: (input: UpdateSlackDeliveryInput): void => updateSlackDelivery({ sql, ...input }),
  };
}

function beginSlackDelivery({
  sql,
  deliveryId,
  contentSha256,
  now,
  nextAttemptAt,
}: SqlCall<BeginSlackDeliveryInput>): SlackDeliveryClaim {
  const nowMs = DateTime.toEpochMillis(now);
  const nextAttemptMs = DateTime.toEpochMillis(nextAttemptAt);

  const cursor = sql.exec(
    'UPDATE slack_deliveries SET status = ?, content_sha256 = ?, attempted_at = ?, next_attempt_at = ? WHERE id = ? AND status = ? RETURNING id',
    SlackDeliveryStatus.Uncertain,
    contentSha256,
    nowMs,
    nextAttemptMs,
    deliveryId,
    SlackDeliveryStatus.Pending,
  );

  const row = decodeFirst({ cursor, schema: SlackDeliveryIdRow });

  if (Option.isSome(row)) {
    return SlackDeliveryClaim.cases.Claimed.make({});
  }

  return SlackDeliveryClaim.cases.AlreadyClaimed.make({});
}

function updateSlackDelivery({
  sql,
  deliveryId,
  status,
  nextAttemptAt,
  messageTimestamp,
  lastError,
  reconciliationCount,
}: SqlCall<UpdateSlackDeliveryInput>): void {
  const nextAttemptMs = Option.map(nextAttemptAt, DateTime.toEpochMillis);
  const nextAttemptValue = Option.getOrNull(nextAttemptMs);
  const messageValue = Option.getOrNull(messageTimestamp);
  const errorValue = Option.getOrNull(lastError);

  sql.exec(
    'UPDATE slack_deliveries SET status = ?, next_attempt_at = ?, message_timestamp = ?, last_error = ?, reconciliation_count = ? WHERE id = ? AND status != ?',
    status,
    nextAttemptValue,
    messageValue,
    errorValue,
    reconciliationCount,
    deliveryId,
    SlackDeliveryStatus.Sent,
  );
}
