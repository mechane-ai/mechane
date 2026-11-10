import { Schema } from 'effect';
import type {
  ImportedExecutionReceipt,
  ImportFence,
  ImportScope,
  ImportScopeSelection,
} from '../../imported-history.ts';
import type { MechScope } from '../api/mechs/mechs.ts';
import type { Page } from '../api/page.ts';
import type { StoreContext } from '../context.ts';
import { RecordNotFound } from '../errors.ts';
import { StoredText } from '../row-values.ts';
import { createImportedContextStore } from './context.ts';
import { validateHistoryRows } from './page.ts';

const ScopeRow = Schema.Struct({
  workspace_id: StoredText,
  workspace_name: StoredText,
  mech_id: StoredText,
  mech_name: StoredText,
  status: Schema.Literals(['active', 'paused', 'archived']),
  definition_revision: Schema.Number,
  is_workspace_suspended: Schema.Boolean,
});

const OwnerRow = Schema.Struct({
  id: StoredText,
  status: Schema.Literals(['queued', 'running', 'waiting']),
  workflow_id: Schema.NullOr(StoredText),
});

const CountsRow = Schema.Struct({
  snapshot_at: StoredText,
  run_count: Schema.Number,
  activity_count: Schema.Number,
  notification_count: Schema.Number,
  console_message_count: Schema.Number,
  execution_receipt_count: Schema.Number,
  pending_execution_receipt_count: Schema.Number,
});

const JsonRecord = Schema.Record(StoredText, Schema.Unknown);

const ReceiptRow = Schema.Struct({
  id: StoredText,
  run_id: StoredText,
  kind: Schema.Literals(['sandbox', 'mcp', 'process', 'browser']),
  status: Schema.Literals(['pending', 'running', 'completed', 'uncertain', 'failed']),
  request: Schema.NullOr(JsonRecord),
  provider_id: Schema.NullOr(StoredText),
  result: Schema.NullOr(JsonRecord),
  created_at: StoredText,
  updated_at: StoredText,
});

type ReceiptPage = MechScope & { readonly afterId: string | null; readonly maxRows: number };

function importScope(value: unknown): ImportScope {
  const row = Schema.decodeUnknownSync(ScopeRow)(value);

  return {
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    mechId: row.mech_id,
    mechName: row.mech_name,
    status: row.status,
    definitionRevision: row.definition_revision,
    isWorkspaceSuspended: row.is_workspace_suspended,
  };
}

function importedExecutionReceipt(value: unknown): ImportedExecutionReceipt {
  const row = Schema.decodeUnknownSync(ReceiptRow)(value);

  return {
    id: row.id,
    runId: row.run_id,
    kind: row.kind,
    status: row.status,
    request: row.request,
    providerId: row.provider_id,
    result: row.result,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createImportInventoryStore(context: StoreContext) {
  const contexts = createImportedContextStore(context);

  async function listImportScopes(input: ImportScopeSelection): Promise<ReadonlyArray<ImportScope>> {
    const result = await context.client.query(
      `SELECT workspace.id AS workspace_id,workspace.name AS workspace_name,mech.id AS mech_id,mech.name AS mech_name,
         mech.status,mech.revision AS definition_revision,
         COALESCE((workspace.policy->>'isSuspended')::boolean,false) AS is_workspace_suspended
       FROM mechane.workspaces workspace JOIN mechane.mechs mech ON mech.workspace_id=workspace.id
       WHERE ($1::uuid IS NULL OR workspace.id=$1) AND ($2::uuid IS NULL OR mech.id=$2)
       ORDER BY workspace.created_at,workspace.id,mech.created_at,mech.id`,
      [input.workspaceId ?? null, input.mechId ?? null],
    );

    return result.rows.map(importScope);
  }

  return {
    listImportScopes,
    async getExportFence(this: void, input: MechScope): Promise<ImportFence> {
      const scopes = await listImportScopes(input);
      const scope = scopes[0];

      if (scope === undefined) {
        throw new RecordNotFound('Imported mech was not found');
      }

      const active = await context.client.query(
        `SELECT id,status,workflow_id FROM mechane.runs
         WHERE workspace_id=$1 AND mech_id=$2 AND status IN ('queued','running','waiting') ORDER BY created_at,id`,
        [input.workspaceId, input.mechId],
      );

      const owners = Schema.decodeUnknownSync(Schema.Array(OwnerRow))(active.rows);

      const counted = await context.client.query(
        `SELECT transaction_timestamp() AS snapshot_at,
           (SELECT count(*) FROM mechane.runs WHERE workspace_id=$1 AND mech_id=$2) AS run_count,
           (SELECT count(*) FROM mechane.activity WHERE workspace_id=$1 AND mech_id=$2) AS activity_count,
           (SELECT count(*) FROM mechane.notifications WHERE workspace_id=$1 AND mech_id=$2) AS notification_count,
           (SELECT count(*) FROM mechane.console_messages WHERE workspace_id=$1 AND mech_id=$2) AS console_message_count,
           (SELECT count(*) FROM mechane.execution_receipts receipts JOIN mechane.runs runs ON runs.id=receipts.run_id
             WHERE runs.workspace_id=$1 AND runs.mech_id=$2) AS execution_receipt_count,
           (SELECT count(*) FROM mechane.execution_receipts receipts JOIN mechane.runs runs ON runs.id=receipts.run_id
             WHERE runs.workspace_id=$1 AND runs.mech_id=$2 AND receipts.status IN ('pending','running','uncertain')) AS pending_execution_receipt_count`,
        [input.workspaceId, input.mechId],
      );

      const counts = Schema.decodeUnknownSync(CountsRow)(counted.rows[0]);
      const mailbox = await contexts.getMechContext(input);

      return {
        scope,
        snapshotAt: counts.snapshot_at,
        activeRuns: owners.map((owner) => ({ id: owner.id, status: owner.status, workflowId: owner.workflow_id })),
        context: mailbox,
        runCount: counts.run_count,
        activityCount: counts.activity_count,
        notificationCount: counts.notification_count,
        consoleMessageCount: counts.console_message_count,
        executionReceiptCount: counts.execution_receipt_count,
        pendingExecutionReceiptCount: counts.pending_execution_receipt_count,
      };
    },
    async listExecutionReceipts(this: void, input: ReceiptPage): Promise<Page<ImportedExecutionReceipt>> {
      validateHistoryRows(input.maxRows);

      const result = await context.client.query(
        `SELECT receipts.* FROM mechane.execution_receipts receipts JOIN mechane.runs runs ON runs.id=receipts.run_id
         WHERE runs.workspace_id=$1 AND runs.mech_id=$2 AND ($3::text IS NULL OR receipts.id>$3)
         ORDER BY receipts.id LIMIT $4`,
        [input.workspaceId, input.mechId, input.afterId, input.maxRows + 1],
      );

      return {
        items: result.rows.slice(0, input.maxRows).map(importedExecutionReceipt),
        hasMore: result.rows.length > input.maxRows,
      };
    },
  };
}
