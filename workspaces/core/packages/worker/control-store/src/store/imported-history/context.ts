import { Schema } from 'effect';
import type { ImportedConsoleMessage, ImportedMechContext, ImportedNotification } from '../../imported-history.ts';
import type { MechScope } from '../api/mechs/mechs.ts';
import type { Page } from '../api/page.ts';
import type { StoreContext } from '../context.ts';
import { StoredText } from '../row-values.ts';
import { validateHistoryRows } from './page.ts';

const JsonRecord = Schema.Record(StoredText, Schema.Unknown);

const ContextRow = Schema.Struct({
  received_sequence: Schema.Number,
  presented_sequence: Schema.Number,
  active_run_id: Schema.NullOr(StoredText),
  is_wake_pending: Schema.Boolean,
  is_environment_checkpoint_required: Schema.Boolean,
  model_messages: Schema.Array(JsonRecord),
  notes_imported_at: Schema.NullOr(StoredText),
  is_context_initialized: Schema.Boolean,
  updated_at: StoredText,
});

const NotificationRow = Schema.Struct({
  id: StoredText,
  workspace_id: StoredText,
  mech_id: StoredText,
  received_sequence: Schema.Number,
  received_at: StoredText,
  text: StoredText,
  source: JsonRecord,
  producer: JsonRecord,
  data: Schema.NullOr(JsonRecord),
});

const ConsoleRow = Schema.Struct({
  id: StoredText,
  workspace_id: StoredText,
  mech_id: StoredText,
  run_id: Schema.NullOr(StoredText),
  sequence: Schema.Number,
  role: Schema.Literals(['user', 'assistant']),
  text: StoredText,
  presentation: Schema.NullOr(JsonRecord),
  created_at: StoredText,
});

const MemoryRow = Schema.Struct({
  path: StoredText,
  text: StoredText,
  digest: StoredText,
  version: Schema.Number,
  run_id: Schema.NullOr(StoredText),
  updated_at: StoredText,
});

const WorkItemRow = Schema.Struct({
  id: StoredText,
  title: StoredText,
  state: Schema.Literals(['open', 'resolved', 'abandoned']),
  note: Schema.NullOr(StoredText),
  created_at: StoredText,
  updated_at: StoredText,
});

type HistoryPage = MechScope & { readonly afterSequence: number; readonly maxRows: number };
type MemoryPage = MechScope & { readonly afterPath: string | null; readonly maxRows: number };
type WorkItemPage = MechScope & { readonly afterId: string | null; readonly maxRows: number };

function importedNotification(value: unknown): ImportedNotification {
  const row = Schema.decodeUnknownSync(NotificationRow)(value);

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    mechId: row.mech_id,
    receivedSequence: row.received_sequence,
    receivedAt: row.received_at,
    text: row.text,
    source: row.source,
    producer: row.producer,
    data: row.data,
  };
}

function importedConsoleMessage(value: unknown): ImportedConsoleMessage {
  const row = Schema.decodeUnknownSync(ConsoleRow)(value);

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

export function createImportedContextStore(context: StoreContext) {
  return {
    async getMechContext(this: void, input: MechScope): Promise<ImportedMechContext | null> {
      const result = await context.client.query(
        'SELECT * FROM mechane.mech_mailboxes WHERE workspace_id=$1 AND mech_id=$2',
        [input.workspaceId, input.mechId],
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = Schema.decodeUnknownSync(ContextRow)(result.rows[0]);

      return {
        receivedSequence: row.received_sequence,
        presentedSequence: row.presented_sequence,
        activeRunId: row.active_run_id,
        isWakePending: row.is_wake_pending,
        isEnvironmentCheckpointRequired: row.is_environment_checkpoint_required,
        modelMessages: row.model_messages,
        notesImportedAt: row.notes_imported_at,
        isContextInitialized: row.is_context_initialized,
        updatedAt: row.updated_at,
      };
    },
    async listNotifications(this: void, input: HistoryPage): Promise<Page<ImportedNotification>> {
      validateHistoryRows(input.maxRows);

      const result = await context.client.query(
        `SELECT * FROM mechane.notifications WHERE workspace_id=$1 AND mech_id=$2 AND received_sequence>$3
         ORDER BY received_sequence LIMIT $4`,
        [input.workspaceId, input.mechId, input.afterSequence, input.maxRows + 1],
      );

      return {
        items: result.rows.slice(0, input.maxRows).map(importedNotification),
        hasMore: result.rows.length > input.maxRows,
      };
    },
    async listConsoleMessages(this: void, input: HistoryPage): Promise<Page<ImportedConsoleMessage>> {
      validateHistoryRows(input.maxRows);

      const result = await context.client.query(
        `SELECT * FROM mechane.console_messages WHERE workspace_id=$1 AND mech_id=$2 AND sequence>$3
         ORDER BY sequence LIMIT $4`,
        [input.workspaceId, input.mechId, input.afterSequence, input.maxRows + 1],
      );

      return {
        items: result.rows.slice(0, input.maxRows).map(importedConsoleMessage),
        hasMore: result.rows.length > input.maxRows,
      };
    },
    async listMemories(this: void, input: MemoryPage) {
      validateHistoryRows(input.maxRows);

      const result = await context.client.query(
        `SELECT path,text,digest,version,run_id,updated_at FROM mechane.memories
         WHERE workspace_id=$1 AND mech_id=$2 AND deleted_at IS NULL AND ($3::text IS NULL OR path>$3)
         ORDER BY path LIMIT $4`,
        [input.workspaceId, input.mechId, input.afterPath, input.maxRows + 1],
      );

      const rows = Schema.decodeUnknownSync(Schema.Array(MemoryRow))(result.rows);

      return { items: rows.slice(0, input.maxRows), hasMore: rows.length > input.maxRows };
    },
    async listWorkItems(this: void, input: WorkItemPage) {
      validateHistoryRows(input.maxRows);

      const result = await context.client.query(
        `SELECT id,title,state,note,created_at,updated_at FROM mechane.work_items
         WHERE workspace_id=$1 AND mech_id=$2 AND ($3::uuid IS NULL OR id>$3)
         ORDER BY id LIMIT $4`,
        [input.workspaceId, input.mechId, input.afterId, input.maxRows + 1],
      );

      const rows = Schema.decodeUnknownSync(Schema.Array(WorkItemRow))(result.rows);

      return { items: rows.slice(0, input.maxRows), hasMore: rows.length > input.maxRows };
    },
  };
}
