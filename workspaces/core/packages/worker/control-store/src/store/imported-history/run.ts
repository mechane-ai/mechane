import { Schema } from 'effect';
import type { ImportedRun } from '../../imported-history.ts';
import { StoredText } from '../row-values.ts';

const JsonRecord = Schema.Record(StoredText, Schema.Unknown);

const AttachmentRow = Schema.Struct({
  id: StoredText,
  name: StoredText,
  mediaType: Schema.NullOr(StoredText),
  sizeBytes: Schema.NullOr(Schema.Number),
  url: Schema.NullOr(StoredText),
});

const RunRow = Schema.Struct({
  id: StoredText,
  workspace_id: StoredText,
  mech_id: StoredText,
  session_id: StoredText,
  input_id: StoredText,
  notification_ids: Schema.Array(StoredText),
  workflow_id: Schema.NullOr(StoredText),
  definition_revision: Schema.Number,
  version: Schema.Number,
  status: Schema.Literals(['queued', 'running', 'waiting', 'completed', 'failed', 'cancelled']),
  input_text: StoredText,
  input_message: JsonRecord,
  attachments: Schema.Array(AttachmentRow),
  origin: JsonRecord,
  created_at: StoredText,
  started_at: Schema.NullOr(StoredText),
  ended_at: Schema.NullOr(StoredText),
  error: Schema.NullOr(StoredText),
  failure_reason: Schema.NullOr(Schema.Literals(['allowance_exhausted', 'faulted'])),
  reply: Schema.NullOr(StoredText),
  cancel_requested_at: Schema.NullOr(StoredText),
});

export function decodeRun(value: unknown): ImportedRun {
  const row = Schema.decodeUnknownSync(RunRow)(value);

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
    inputMessage: row.input_message,
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
