import { Schema } from 'effect';
import type { Run, StoredMessages } from '../../domain.ts';
import type { StoreContext } from '../context.ts';
import { decodeModelMessage, decodeRun, decodeUiMessages } from './rows.ts';

type RunLookup = { readonly runId: string; readonly workspaceId?: string };
type WorkflowLookup = { readonly workflowId: string };
type MechLookup = { readonly workspaceId: string; readonly mechId: string };
type SessionLookup = { readonly sessionId: string };
type UnfinishedCursor = { readonly createdAt: string; readonly id: string };
type UnfinishedQuery = { readonly maxRuns?: number; readonly after?: UnfinishedCursor };
const DEFAULT_MAX_UNFINISHED_RUNS = 100;

const StoredMessageSchema = Schema.Struct({
  model_message: Schema.NullOr(Schema.Unknown),
  ui_message: Schema.NullOr(Schema.Unknown),
});

export function createExecutionReads(context: StoreContext) {
  async function getRun({ runId, workspaceId }: RunLookup): Promise<Run | null> {
    const found = await context.client.query(
      `
      SELECT r.*,i.input_text,i.input_message,i.attachments,i.origin
      FROM mechane.runs r JOIN mechane.inputs i ON i.id=r.input_id
      WHERE r.id=$1 AND ($2::uuid IS NULL OR r.workspace_id=$2)`,
      [runId, workspaceId ?? null],
    );

    if (found.rows.length === 0) {
      return null;
    }

    return await decodeRun(found.rows[0]);
  }

  return {
    getRun,
    getRunInput: async (input: RunLookup) => {
      const run = await getRun(input);

      if (run === null) {
        return null;
      }

      return { inputMessage: run.inputMessage, attachments: run.attachments };
    },
    getRunByWorkflowId: async ({ workflowId }: WorkflowLookup): Promise<Run | null> => {
      const found = await context.client.query(
        `
        SELECT r.*,i.input_text,i.input_message,i.attachments,i.origin
        FROM mechane.runs r JOIN mechane.inputs i ON i.id=r.input_id WHERE r.workflow_id=$1`,
        [workflowId],
      );

      if (found.rows.length === 0) {
        return null;
      }

      return await decodeRun(found.rows[0]);
    },
    nextQueuedRun: async ({ workspaceId, mechId }: MechLookup): Promise<Run | null> => {
      const found = await context.client.query(
        `
        SELECT r.*,i.input_text,i.input_message,i.attachments,i.origin
        FROM mechane.runs r JOIN mechane.inputs i ON i.id=r.input_id
        WHERE r.workspace_id=$1 AND r.mech_id=$2 AND r.status='queued'
        ORDER BY r.created_at,r.id LIMIT 1`,
        [workspaceId, mechId],
      );

      if (found.rows.length === 0) {
        return null;
      }

      return await decodeRun(found.rows[0]);
    },
    listUnfinishedRuns: async ({ maxRuns = DEFAULT_MAX_UNFINISHED_RUNS, after }: UnfinishedQuery = {}): Promise<
      ReadonlyArray<Run>
    > => {
      const found = await context.client.query(
        `
        SELECT r.*,i.input_text,i.input_message,i.attachments,i.origin
        FROM mechane.runs r JOIN mechane.inputs i ON i.id=r.input_id
        WHERE r.status IN ('queued','running','waiting')
          AND ($2::timestamptz IS NULL OR (date_trunc('milliseconds',r.created_at),r.id)>($2,$3))
        ORDER BY date_trunc('milliseconds',r.created_at),r.id LIMIT $1`,
        [maxRuns, after?.createdAt ?? null, after?.id ?? null],
      );

      const runs = found.rows.map(decodeRun);

      return await Promise.all(runs);
    },
    getRunMessages: async ({ runId }: Pick<RunLookup, 'runId'>): Promise<StoredMessages> => {
      const found = await context.client.query(
        `SELECT model_message,ui_message FROM mechane.messages WHERE run_id=$1 ORDER BY position`,
        [runId],
      );

      return await decodeStoredMessages(found.rows);
    },
    getSessionMessages: async ({ sessionId }: SessionLookup): Promise<StoredMessages> => {
      const found = await context.client.query(
        `
        SELECT m.model_message,m.ui_message FROM mechane.messages m
        JOIN mechane.runs r ON r.id=m.run_id
        WHERE m.session_id=$1 AND r.status IN ('completed','failed','cancelled')
        ORDER BY r.created_at,r.id,m.position`,
        [sessionId],
      );

      return await decodeStoredMessages(found.rows);
    },
  };
}

async function decodeStoredMessages(values: ReadonlyArray<unknown>): Promise<StoredMessages> {
  const rows = values.map((row) => Schema.decodeUnknownSync(StoredMessageSchema)(row));

  const modelMessages = rows
    .filter((row) => row.model_message !== null)
    .map((row) => decodeModelMessage(row.model_message));

  const suppliedUiMessages = rows.filter((row) => row.ui_message !== null).map((row) => row.ui_message);
  const uiMessages = await decodeUiMessages(suppliedUiMessages);

  return { modelMessages, uiMessages };
}
