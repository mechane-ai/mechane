import { RequestInvalid, TurnNotFound } from '@mechane/protocol';
import { TurnId } from '@mechane/records';
import { Schema } from 'effect';
import type { ActivityEvent, Run, SpendReservation } from '../../../domain.ts';
import type { StoreContext } from '../../context.ts';
import { decodeRun } from '../../execution/rows.ts';
import type { MechScope } from '../mechs/mechs.ts';
import type { Page } from '../page.ts';
import { readToolTrace } from './tool-trace.ts';

export type RunPageInput = MechScope & {
  readonly after: string | null;
  readonly maxRows: number;
  readonly notificationId?: string;
};

export type ActivityPageInput = MechScope & {
  readonly after?: number;
  readonly before?: number | null;
  readonly runId?: string;
  readonly maxRows: number;
  readonly isNewestFirst?: boolean;
};

export type RunReadInput = MechScope & { readonly runId: string };

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
       AND ($5::uuid IS NULL OR runs.notification_ids @> ARRAY[$5::uuid])
     ORDER BY runs.created_at DESC,runs.id DESC LIMIT $4`,
    [input.workspaceId, input.mechId, input.after, input.maxRows + 1, input.notificationId ?? null],
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

export function createReadStore(context: StoreContext) {
  return {
    listRuns: (input: RunPageInput) => listRuns(context, input),
    listActivities: (input: ActivityPageInput) => listActivities(context, input),
    getRunTrace: (input: RunReadInput) => getRunTrace(context, input),
    getRunCancellation: (input: RunReadInput) => getRunCancellation(context, input),
  };
}

function activityOrder(isNewestFirst: boolean): 'DESC' | 'ASC' {
  if (isNewestFirst) {
    return 'DESC';
  }

  return 'ASC';
}
