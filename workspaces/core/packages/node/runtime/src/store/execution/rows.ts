import { modelMessageSchema, validateUIMessages } from 'ai';
import type { ModelMessage, UIMessage } from 'ai';
import { Schema } from 'effect';
import type { Run, Session } from '../../domain.ts';
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

export const InputOriginSchema = Schema.Union([SlackOriginSchema, ConsoleOriginSchema]);
export const InputAttachmentsSchema = Schema.Array(AttachmentSchema);

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

const RunSchema = Schema.Struct({
  id: Schema.String,
  workspace_id: Schema.String,
  mech_id: Schema.String,
  session_id: Schema.String,
  input_id: Schema.String,
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

const SessionSchema = Schema.Struct({
  id: Schema.String,
  workspace_id: Schema.String,
  mech_id: Schema.String,
  title: Schema.String,
  source: Schema.Literals(['console', 'slack', 'api']),
  created_at: Schema.String,
  updated_at: Schema.String,
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

export function decodeSession(value: unknown): Session {
  const row = Schema.decodeUnknownSync(SessionSchema)(value);

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    mechId: row.mech_id,
    title: row.title,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
