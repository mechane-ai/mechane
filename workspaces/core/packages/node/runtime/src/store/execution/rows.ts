import { modelMessageSchema, validateUIMessages } from 'ai';
import type { ModelMessage, UIMessage } from 'ai';
import { Schema } from 'effect';
import type { Run } from '../../domain.ts';
import { StoreConflict } from '../errors.ts';

const AttachmentSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  mediaType: Schema.NullOr(Schema.String),
  sizeBytes: Schema.NullOr(Schema.Number),
  url: Schema.NullOr(Schema.String),
});

const SlackOriginSchema = Schema.Struct({
  kind: Schema.Literal('slack'),
  teamId: Schema.String,
  channelId: Schema.String,
  threadId: Schema.String,
  messageId: Schema.String,
  userId: Schema.String,
  bindingId: Schema.String,
  installationId: Schema.String,
});

const ConsoleOriginSchema = Schema.Struct({ kind: Schema.Literals(['console', 'api']), principalId: Schema.String });

const InputOriginSchema = Schema.Union([
  SlackOriginSchema,
  ConsoleOriginSchema,
  Schema.Struct({ kind: Schema.Literal('notification'), notificationId: Schema.NullOr(Schema.String) }),
]);

const InputAttachmentsSchema = Schema.Array(AttachmentSchema);

export async function decodeUiMessages(messages: ReadonlyArray<unknown>): Promise<ReadonlyArray<UIMessage>> {
  if (messages.length === 0) {
    return [];
  }

  try {
    return await validateUIMessages({ messages });
  } catch {
    throw new StoreConflict('Conversation messages are invalid');
  }
}

export function decodeModelMessage(value: unknown): ModelMessage {
  try {
    return modelMessageSchema.parse(value);
  } catch {
    throw new StoreConflict('Model message is invalid');
  }
}

function replaceModelData(this: Readonly<Record<string, unknown>>, key: string, value: unknown): unknown {
  const original = this[key];

  if (original instanceof Uint8Array) {
    return Buffer.from(original).toString('base64');
  }

  if (original instanceof ArrayBuffer) {
    return Buffer.from(original).toString('base64');
  }

  if (original instanceof URL) {
    return original.href;
  }

  return value;
}

export function normalizeModelMessages(messages: ReadonlyArray<ModelMessage>): ReadonlyArray<ModelMessage> {
  return messages.map((message) => decodeModelMessage(JSON.parse(JSON.stringify(message, replaceModelData))));
}

const RunSchema = Schema.Struct({
  id: Schema.String,
  workspace_id: Schema.String,
  mech_id: Schema.String,
  session_id: Schema.String,
  input_id: Schema.String,
  notification_ids: Schema.Array(Schema.String),
  workflow_id: Schema.NullOr(Schema.String),
  definition_revision: Schema.Number,
  version: Schema.Number,
  status: Schema.Literals(['queued', 'running', 'waiting', 'completed', 'failed', 'cancelled']),
  input_text: Schema.String,
  input_message: Schema.Unknown,
  attachments: InputAttachmentsSchema,
  origin: InputOriginSchema,
  created_at: Schema.String,
  started_at: Schema.NullOr(Schema.String),
  ended_at: Schema.NullOr(Schema.String),
  error: Schema.NullOr(Schema.String),
  failure_reason: Schema.NullOr(Schema.Literals(['allowance_exhausted', 'faulted'])),
  reply: Schema.NullOr(Schema.String),
  cancel_requested_at: Schema.NullOr(Schema.String),
});

function decodeRunFields(value: unknown) {
  try {
    return Schema.decodeUnknownSync(RunSchema)(value);
  } catch {
    throw new StoreConflict('Stored run is invalid');
  }
}

export async function decodeRun(value: unknown): Promise<Run> {
  const row = decodeRunFields(value);
  const messages = await decodeUiMessages([row.input_message]);
  const inputMessage = messages[0];

  if (inputMessage === undefined) {
    throw new StoreConflict('Run input is missing');
  }

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    mechId: row.mech_id,
    sessionId: row.session_id,
    inputId: row.input_id,
    notificationIds: row.notification_ids,
    workflowId: row.workflow_id,
    definitionRevision: row.definition_revision,
    version: row.version,
    status: row.status,
    inputText: row.input_text,
    inputMessage,
    attachments: row.attachments,
    origin: row.origin,
    createdAt: row.created_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    error: row.error,
    failureReason: row.failure_reason,
    reply: row.reply,
    cancelRequestedAt: row.cancel_requested_at,
  };
}
