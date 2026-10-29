import { MechStatus } from '@mechane/protocol';
import { SlackDeliveryStatus, SlackDestination } from '@mechane/records';
import type { SlackBindingId, SlackDeliveryId } from '@mechane/records';
import { decodeOne, decodeRows } from '@mechane/store';
import type { RecordsInput, SqlCall } from '@mechane/store';
import { DateTime, Schema } from 'effect';
import type { Option } from 'effect';
import { SlackDeliveryRow } from './schemas.ts';

type EnqueueSlackDeliveryInput = {
  readonly deliveryId: SlackDeliveryId;
  readonly destination: SlackDestination;
  readonly text: string;
  readonly now: DateTime.Utc;
};

const SlackDeliveryDue = Schema.Struct({
  /** Absent when no delivery has a scheduled recovery deadline. */
  at: Schema.OptionFromNullOr(Schema.DateTimeUtcFromMillis),
});

type SlackDeliveryDue = typeof SlackDeliveryDue.Type;

type EnqueueSlackBindingDeliveryInput = {
  readonly deliveryId: SlackDeliveryId;
  readonly bindingId: SlackBindingId;
  readonly text: string;
  readonly now: DateTime.Utc;
};

type ResolveSlackDeliveryInput = { readonly deliveryId: SlackDeliveryId; readonly destination: SlackDestination };

type PendingSlackDeliveriesInput = { readonly now: DateTime.Utc };

const SLACK_DELIVERY_BATCH_COUNT = 10;
const SLACK_DELIVERY_LIST_COUNT = 100;

/** Durable reply intents, frozen destinations, and due-delivery queries. */
export function slackDeliveryRecords({ sql }: RecordsInput) {
  return {
    enqueueSlackDelivery: (input: EnqueueSlackDeliveryInput): void => enqueueSlackDelivery({ sql, ...input }),
    enqueueSlackBindingDelivery: (input: EnqueueSlackBindingDeliveryInput): void =>
      enqueueSlackBindingDelivery({ sql, ...input }),
    resolveSlackDelivery: (input: ResolveSlackDeliveryInput): void => resolveSlackDelivery({ sql, ...input }),
    pendingSlackDeliveries: (input: PendingSlackDeliveriesInput): ReadonlyArray<SlackDeliveryRow> =>
      pendingSlackDeliveries({ sql, ...input }),
    slackDeliveries: (): ReadonlyArray<SlackDeliveryRow> => slackDeliveries({ sql }),
    nextSlackDeliveryAt: (): Option.Option<DateTime.Utc> => nextSlackDeliveryAt({ sql }),
  };
}

function enqueueSlackDelivery({ sql, deliveryId, destination, text, now }: SqlCall<EnqueueSlackDeliveryInput>): void {
  const wire = Schema.fromJsonString(SlackDestination);
  const serialized = Schema.encodeSync(wire)(destination);
  const nowMs = DateTime.toEpochMillis(now);

  sql.exec(
    'INSERT INTO slack_deliveries (id, binding_id, destination, text, status, created_at, next_attempt_at, reconciliation_count) VALUES (?, ?, ?, ?, ?, ?, ?, 0) ON CONFLICT (id) DO NOTHING',
    deliveryId,
    destination.bindingId,
    serialized,
    text,
    SlackDeliveryStatus.Pending,
    nowMs,
    nowMs,
  );
}

function enqueueSlackBindingDelivery({
  sql,
  deliveryId,
  bindingId,
  text,
  now,
}: SqlCall<EnqueueSlackBindingDeliveryInput>): void {
  const nowMs = DateTime.toEpochMillis(now);

  sql.exec(
    'INSERT INTO slack_deliveries (id, binding_id, text, status, created_at, next_attempt_at, reconciliation_count) VALUES (?, ?, ?, ?, ?, ?, 0) ON CONFLICT (id) DO NOTHING',
    deliveryId,
    bindingId,
    text,
    SlackDeliveryStatus.Pending,
    nowMs,
    nowMs,
  );
}

function resolveSlackDelivery({ sql, deliveryId, destination }: SqlCall<ResolveSlackDeliveryInput>): void {
  const wire = Schema.fromJsonString(SlackDestination);
  const serialized = Schema.encodeSync(wire)(destination);

  sql.exec('UPDATE slack_deliveries SET destination = ? WHERE id = ? AND destination IS NULL', serialized, deliveryId);
}

function pendingSlackDeliveries({ sql, now }: SqlCall<PendingSlackDeliveriesInput>): ReadonlyArray<SlackDeliveryRow> {
  const nowMs = DateTime.toEpochMillis(now);

  const cursor = sql.exec(
    'SELECT * FROM slack_deliveries WHERE status IN (?, ?) AND next_attempt_at <= ? ORDER BY created_at LIMIT ?',
    SlackDeliveryStatus.Pending,
    SlackDeliveryStatus.Uncertain,
    nowMs,
    SLACK_DELIVERY_BATCH_COUNT,
  );

  return decodeRows({ cursor, schema: SlackDeliveryRow });
}

function slackDeliveries({ sql }: RecordsInput): ReadonlyArray<SlackDeliveryRow> {
  const cursor = sql.exec('SELECT * FROM slack_deliveries ORDER BY created_at DESC LIMIT ?', SLACK_DELIVERY_LIST_COUNT);

  return decodeRows({ cursor, schema: SlackDeliveryRow });
}

function nextSlackDeliveryAt({ sql }: RecordsInput): Option.Option<DateTime.Utc> {
  const cursor = sql.exec(
    'SELECT MIN(next_attempt_at) AS at FROM slack_deliveries WHERE status IN (?, ?) AND EXISTS (SELECT id FROM mech WHERE status = ?)',
    SlackDeliveryStatus.Pending,
    SlackDeliveryStatus.Uncertain,
    MechStatus.Active,
  );

  return decodeOne({ cursor, schema: SlackDeliveryDue }).at;
}
