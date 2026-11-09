import { Schema } from 'effect';
import type { ConsoleMessage, Notification, NotificationSource } from '../../domain.ts';
import { StoreConflict } from '../errors.ts';

export const NotificationSourceSchema = Schema.Struct({
  name: Schema.String,
  eventId: Schema.String,
  url: Schema.optional(Schema.String),
});

export const NotificationProducerSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('member'), principalId: Schema.String }),
  Schema.Struct({ kind: Schema.Literal('producer'), id: Schema.String }),
]);

const NotificationRow = Schema.Struct({
  id: Schema.String,
  workspace_id: Schema.String,
  mech_id: Schema.String,
  received_sequence: Schema.Number,
  received_at: Schema.String,
  text: Schema.String,
  source: NotificationSourceSchema,
  producer: NotificationProducerSchema,
  data: Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown)),
});

const ConsoleMessageRow = Schema.Struct({
  id: Schema.String,
  workspace_id: Schema.String,
  mech_id: Schema.String,
  run_id: Schema.NullOr(Schema.String),
  sequence: Schema.Number,
  role: Schema.Literals(['user', 'assistant']),
  text: Schema.String,
  presentation: Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown)),
  created_at: Schema.String,
});

export function decodeNotification(value: unknown): Notification {
  const row = Schema.decodeUnknownSync(NotificationRow)(value);
  let source: NotificationSource = { name: row.source.name, eventId: row.source.eventId };

  if (row.source.url !== undefined) {
    source = { ...source, url: row.source.url };
  }

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    mechId: row.mech_id,
    receivedSequence: row.received_sequence,
    receivedAt: row.received_at,
    text: row.text,
    source,
    producer: row.producer,
    data: row.data,
  };
}

export function decodeConsoleMessage(value: unknown): ConsoleMessage {
  const row = Schema.decodeUnknownSync(ConsoleMessageRow)(value);

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    mechId: row.mech_id,
    runId: row.run_id,
    sequence: row.sequence,
    role: row.role,
    text: row.text,
    presentation: row.presentation,
    createdAt: row.created_at,
  };
}

export function requireSequence(sequence: number): void {
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new StoreConflict('Notification sequence is invalid');
  }
}
