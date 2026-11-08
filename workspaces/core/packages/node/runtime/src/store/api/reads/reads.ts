import { RequestInvalid, TurnNotFound } from '@mechane/protocol';
import { TurnId } from '@mechane/records';
import type { UIMessage } from 'ai';
import { Schema } from 'effect';
import type { ActivityEvent, InputOrigin, Run, SpendReservation } from '../../../domain.ts';
import type { StoreContext } from '../../context.ts';
import { decodeRun } from '../../execution/rows.ts';
import type { MechScope } from '../mechs/mechs.ts';
import { pageFromRows } from '../page.ts';
import type { Page } from '../page.ts';
import { readToolTrace } from './tool-trace.ts';

export type RunPageInput = MechScope & { readonly after: string | null; readonly maxRows: number };

export type ActivityPageInput = MechScope & {
  readonly after?: number;
  readonly before?: number | null;
  readonly runId?: string;
  readonly maxRows: number;
  readonly isNewestFirst?: boolean;
};

export type RunReadInput = MechScope & { readonly runId: string };
export type SessionPageInput = MechScope & { readonly after: string | null; readonly maxRows: number };
export type SessionIdentity = MechScope & { readonly sessionId: string };

export type SessionMessagesInput = MechScope & {
  readonly sessionId: string;
  readonly before: string | null;
  readonly maxRows: number;
};

export type SessionSummary = {
  readonly id: string;
  readonly mechId: string;
  readonly title: string;
  readonly source: 'console' | 'slack' | 'api';
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly activeRunId: string | null;
  readonly activeWorkflowId: string | null;
};

export type SessionDetails = SessionSummary & { readonly sourceOrigin: InputOrigin | null };

type MessageRow = {
  readonly id: string;
  readonly message: UIMessage;
  readonly runId: string;
  readonly createdAt: string;
  readonly position: number;
};

export type SessionMessagePage = {
  readonly session: SessionDetails;
  readonly messages: ReadonlyArray<UIMessage>;
  readonly hasMore: boolean;
  readonly before: string | null;
};

async function listRuns(context: StoreContext, input: RunPageInput): Promise<Page<Run>> {
  if (input.after !== null) {
    const cursor = await context.client.query(
      'SELECT id FROM mechane.runs WHERE workspace_id=$1 AND mech_id=$2 AND id=$3',
      [input.workspaceId, input.mechId, input.after],
    );

    if (cursor.rowCount === 0) {
      throw new RequestInvalid({ reason: 'The run page cursor is not in this mech' });
    }
  }

  const result = await context.client.query(
    `SELECT runs.*,inputs.input_text,inputs.input_message,inputs.attachments,inputs.origin
     FROM mechane.runs runs JOIN mechane.inputs inputs ON inputs.id=runs.input_id
     WHERE runs.workspace_id=$1 AND runs.mech_id=$2 AND ($3::uuid IS NULL OR (runs.created_at,runs.id)<
       (SELECT created_at,id FROM mechane.runs WHERE id=$3))
     ORDER BY runs.created_at DESC,runs.id DESC LIMIT $4`,
    [input.workspaceId, input.mechId, input.after, input.maxRows + 1],
  );

  const items = await Promise.all(result.rows.slice(0, input.maxRows).map(decodeRun));

  return { items, hasMore: result.rows.length > input.maxRows };
}

async function listActivities(context: StoreContext, input: ActivityPageInput): Promise<Page<ActivityEvent>> {
  const order = activityOrder(input.isNewestFirst === true);

  const result = await context.client.query<ActivityEvent>(
    `SELECT id,sequence,workspace_id AS "workspaceId",mech_id AS "mechId",run_id AS "runId",type,data AS payload,created_at AS "createdAt"
     FROM mechane.activity WHERE workspace_id=$1 AND mech_id=$2
       AND ($3::bigint IS NULL OR sequence>$3) AND ($4::bigint IS NULL OR sequence<$4)
       AND ($5::uuid IS NULL OR run_id=$5) ORDER BY sequence ${order} LIMIT $6`,
    [
      input.workspaceId,
      input.mechId,
      input.after ?? null,
      input.before ?? null,
      input.runId ?? null,
      input.maxRows + 1,
    ],
  );

  const items = result.rows.slice(0, input.maxRows);

  if (input.isNewestFirst === true) {
    return { items: items.toReversed(), hasMore: result.rows.length > input.maxRows };
  }

  return { items, hasMore: result.rows.length > input.maxRows };
}

async function getRunTrace(context: StoreContext, input: RunReadInput) {
  const result = await context.client.query(
    `SELECT runs.*,inputs.input_text,inputs.input_message,inputs.attachments,inputs.origin
     FROM mechane.runs runs JOIN mechane.inputs inputs ON inputs.id=runs.input_id
     WHERE runs.workspace_id=$1 AND runs.mech_id=$2 AND runs.id=$3`,
    [input.workspaceId, input.mechId, input.runId],
  );

  const row: unknown = result.rows[0];

  if (row === undefined) {
    throw new TurnNotFound({ turnId: Schema.decodeUnknownSync(TurnId)(input.runId) });
  }

  const run = await decodeRun(row);

  const dispatches = await context.client.query<SpendReservation>(
    `SELECT id,run_id AS "runId",workspace_id AS "workspaceId",mech_id AS "mechId",model,
      reserved_micros AS "reservedMicros",settled_micros AS "settledMicros",usage,state,
      created_at AS "createdAt",settled_at AS "settledAt"
     FROM mechane.spend_reservations WHERE run_id=$1 ORDER BY created_at,id`,
    [input.runId],
  );

  const events = await context.client.query<ActivityEvent>(
    `SELECT id,sequence,workspace_id AS "workspaceId",mech_id AS "mechId",run_id AS "runId",type,data AS payload,created_at AS "createdAt"
     FROM mechane.activity WHERE run_id=$1 AND type IN ('turn.answered','tool.started','tool.completed','tool.failed','tool.input') ORDER BY sequence`,
    [input.runId],
  );

  const tools = await readToolTrace({ context, runId: run.id, events: events.rows });

  return { run, dispatches: dispatches.rows, events: events.rows, ...tools };
}

async function getRunCancellation(context: StoreContext, input: RunReadInput) {
  const found = await context.client.query<{ readonly cancelerId: string; readonly canceledAt: string }>(
    `SELECT data->>'cancelerId' AS "cancelerId",created_at AS "canceledAt" FROM mechane.activity
     WHERE workspace_id=$1 AND mech_id=$2 AND run_id=$3 AND type='turn.canceled' ORDER BY sequence LIMIT 1`,
    [input.workspaceId, input.mechId, input.runId],
  );

  return found.rows[0] ?? null;
}

async function listSessions(context: StoreContext, input: SessionPageInput): Promise<Page<SessionSummary>> {
  if (input.after !== null) {
    const cursor = await context.client.query(
      'SELECT id FROM mechane.sessions WHERE workspace_id=$1 AND mech_id=$2 AND id=$3',
      [input.workspaceId, input.mechId, input.after],
    );

    if (cursor.rowCount === 0) {
      throw new RequestInvalid({ reason: 'The conversation page cursor is not in this mech' });
    }
  }

  const result = await context.client.query<SessionSummary>(
    `SELECT sessions.id, sessions.mech_id AS "mechId", sessions.created_at AS "createdAt",
  sessions.updated_at AS "updatedAt",sessions.title,sessions.source,
  active.id AS "activeRunId",active.workflow_id AS "activeWorkflowId" FROM mechane.sessions sessions LEFT JOIN LATERAL (
    SELECT id,workflow_id FROM mechane.runs WHERE session_id=sessions.id AND status IN ('queued','running','waiting')
    ORDER BY created_at,id LIMIT 1
  ) active ON true
     WHERE sessions.workspace_id=$1 AND sessions.mech_id=$2 AND ($3::uuid IS NULL OR (sessions.updated_at,sessions.id)<
       (SELECT updated_at,id FROM mechane.sessions WHERE id=$3))
     ORDER BY sessions.updated_at DESC,sessions.id DESC LIMIT $4`,
    [input.workspaceId, input.mechId, input.after, input.maxRows + 1],
  );

  return pageFromRows({ rows: result.rows, maxRows: input.maxRows });
}

async function getSessionSummary(context: StoreContext, input: SessionIdentity): Promise<SessionDetails> {
  const sessionResult = await context.client.query<SessionDetails>(
    `SELECT sessions.id, sessions.mech_id AS "mechId", sessions.created_at AS "createdAt",
  sessions.updated_at AS "updatedAt",sessions.title,sessions.source,
  (SELECT origin FROM mechane.inputs WHERE session_id=sessions.id ORDER BY created_at,id LIMIT 1) AS "sourceOrigin",
  active.id AS "activeRunId",active.workflow_id AS "activeWorkflowId" FROM mechane.sessions sessions LEFT JOIN LATERAL (
    SELECT id,workflow_id FROM mechane.runs WHERE session_id=sessions.id AND status IN ('queued','running','waiting')
    ORDER BY created_at,id LIMIT 1
  ) active ON true
     WHERE sessions.workspace_id=$1 AND sessions.mech_id=$2 AND sessions.id=$3`,
    [input.workspaceId, input.mechId, input.sessionId],
  );

  const session = sessionResult.rows[0];

  if (session === undefined) {
    throw new RequestInvalid({ reason: 'The conversation is not in this mech' });
  }

  return session;
}

async function getRecentSession(context: StoreContext, input: MechScope): Promise<string | null> {
  const result = await context.client.query<{ readonly id: string }>(
    `SELECT sessions.id FROM mechane.sessions sessions
     WHERE sessions.workspace_id=$1 AND sessions.mech_id=$2
       AND EXISTS(SELECT 1 FROM mechane.inputs WHERE session_id=sessions.id)
     ORDER BY sessions.updated_at DESC,sessions.id DESC LIMIT 1`,
    [input.workspaceId, input.mechId],
  );

  return result.rows[0]?.id ?? null;
}

async function listSessionMessages(context: StoreContext, input: SessionMessagesInput): Promise<SessionMessagePage> {
  const session = await getSessionSummary(context, input);

  if (input.before !== null) {
    const cursor = await context.client.query(
      `SELECT id FROM mechane.inputs WHERE session_id=$1 AND id=$2
       UNION ALL SELECT id FROM mechane.messages WHERE session_id=$1 AND id=$2`,
      [input.sessionId, input.before],
    );

    if (cursor.rowCount === 0) {
      throw new RequestInvalid({ reason: 'The message page cursor is not in this conversation' });
    }
  }

  const result = await context.client.query<MessageRow>(
    `WITH conversation_messages AS (
       SELECT inputs.id,inputs.input_message AS message,runs.id AS run_id,inputs.created_at,-1 AS position
       FROM mechane.inputs inputs JOIN mechane.runs runs ON runs.input_id=inputs.id WHERE inputs.session_id=$1
       UNION ALL
       SELECT messages.id,messages.ui_message AS message,messages.run_id,messages.created_at,messages.position
       FROM mechane.messages messages JOIN mechane.runs runs ON runs.id=messages.run_id
       JOIN mechane.inputs inputs ON inputs.id=runs.input_id
       WHERE messages.session_id=$1 AND messages.ui_message IS NOT NULL
         AND messages.ui_message->>'id' <> inputs.input_message->>'id'
     )
     SELECT id,message,run_id AS "runId",created_at AS "createdAt",position FROM conversation_messages
     WHERE $2::uuid IS NULL OR (created_at,position,id)<
       (SELECT created_at,position,id FROM conversation_messages WHERE id=$2)
     ORDER BY created_at DESC,position DESC,id DESC LIMIT $3`,
    [input.sessionId, input.before, input.maxRows + 1],
  );

  const rows = result.rows.slice(0, input.maxRows).toReversed();

  const messages = rows.map((row) => {
    const metadata = row.message.metadata;
    const storedMetadata = messageMetadata(metadata);

    return { ...row.message, metadata: { ...storedMetadata, runId: row.runId, createdAt: row.createdAt } };
  });

  return { session, messages, hasMore: result.rows.length > input.maxRows, before: rows[0]?.id ?? null };
}

export function createReadStore(context: StoreContext) {
  return {
    listRuns: (input: RunPageInput) => listRuns(context, input),
    listActivities: (input: ActivityPageInput) => listActivities(context, input),
    getRunTrace: (input: RunReadInput) => getRunTrace(context, input),
    getRunCancellation: (input: RunReadInput) => getRunCancellation(context, input),
    listSessions: (input: SessionPageInput) => listSessions(context, input),
    getSessionSummary: (input: SessionIdentity) => getSessionSummary(context, input),
    getRecentSession: (input: MechScope) => getRecentSession(context, input),
    listSessionMessages: (input: SessionMessagesInput) => listSessionMessages(context, input),
  };
}

function activityOrder(isNewestFirst: boolean): 'DESC' | 'ASC' {
  if (isNewestFirst) {
    return 'DESC';
  }

  return 'ASC';
}

function messageMetadata(metadata: unknown): object {
  if (typeof metadata === 'object' && metadata !== null && !Array.isArray(metadata)) {
    return metadata;
  }

  return {};
}
