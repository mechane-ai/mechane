import {
  decodePage,
  encodePage,
  ManagedStoreError,
  pageSize,
  readManagedSessionUsages,
} from '@mechane/authority-store';
import type { ManagedPageQuery, ManagedScope, StoreContext } from '@mechane/authority-store';
import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { renderSession, SessionRow } from './session-records.ts';

export type SessionQuery = ManagedPageQuery & {
  readonly search?: string;
  readonly agentId?: string;
  readonly agentVersion?: number;
  readonly deploymentId?: string;
  readonly memoryStoreId?: string;
  readonly order?: 'desc' | 'asc';
  readonly statuses?: ReadonlyArray<string>;
};

type SessionListInput = { readonly scope: ManagedScope; readonly query?: SessionQuery };
const BACKWARD_PREFIX = 'previous.';

type CursorInput = {
  readonly row: SessionRow | undefined;
  readonly hasPage: boolean;
  readonly isBackward: boolean;
  readonly order: NonNullable<SessionQuery['order']>;
};

function cursor({ row, hasPage, isBackward, order }: CursorInput) {
  if (row === undefined || !hasPage) {
    return null;
  }

  const key = encodePage({ createdAt: row.created_at, id: row.id });
  const token = `${order}.${key}`;

  if (isBackward) {
    return `previous.${token}`;
  }

  return token;
}

async function readPage(context: StoreContext, query: SessionQuery) {
  const token = query.page;

  if (token === undefined) {
    return { isBackward: false, key: null };
  }

  const isBackward = token.startsWith(BACKWARD_PREFIX);
  const order = query.order ?? 'desc';

  function cursorPrefix() {
    if (isBackward) {
      return `${BACKWARD_PREFIX}${order}.`;
    }

    return `${order}.`;
  }

  const prefix = cursorPrefix();

  if (!token.startsWith(prefix)) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Session cursor does not match the requested order');
  }

  const key = decodePage(token.slice(prefix.length));
  const bounds = [query.createdAfter, query.createdBefore, query.createdAfterExclusive, query.createdBeforeExclusive];

  if (key !== null && bounds.some((bound) => bound !== undefined)) {
    const checked = await context.client.query(
      `SELECT (($2::timestamptz IS NULL OR $1::timestamptz>=$2) AND ($3::timestamptz IS NULL OR $1<=$3)
       AND ($4::timestamptz IS NULL OR $1>$4) AND ($5::timestamptz IS NULL OR $1<$5)) AS is_included`,
      [key.createdAt, ...bounds],
    );

    if (!Schema.decodeUnknownSync(Schema.Struct({ is_included: Schema.Boolean }))(checked.rows[0]).is_included) {
      throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Session cursor is outside the requested time range');
    }
  }

  return { isBackward, key };
}

function visiblePage(rows: ReadonlyArray<SessionRow>, maxRows: number, isBackward: boolean) {
  const visible = rows.slice(0, maxRows);

  if (isBackward) {
    return visible.toReversed();
  }

  return visible;
}

function hasPreviousPage(isBackward: boolean, hasMore: boolean, hasCursor: boolean): boolean {
  if (isBackward) {
    return hasMore;
  }

  return hasCursor;
}

export async function listSessions(context: StoreContext, { scope, query = {} }: SessionListInput) {
  const limit = pageSize(query);
  const { isBackward, key } = await readPage(context, query);
  const isAscending = (query.order === 'asc') !== isBackward;

  const parameters = [
    scope.workspaceId,
    scope.principalId,
    scope.isAdmin,
    query.includeArchived ?? false,
    query.agentId ?? null,
    query.agentVersion ?? null,
    query.statuses ?? null,
    query.deploymentId ?? null,
    query.memoryStoreId ?? null,
    query.createdAfter ?? null,
    query.createdBefore ?? null,
    query.createdAfterExclusive ?? null,
    query.createdBeforeExclusive ?? null,
    key?.createdAt ?? null,
    key?.id ?? null,
    limit + 1,
    query.search?.trim() ?? null,
  ];

  async function querySessions() {
    if (isAscending) {
      return await context.client.query(
        `SELECT * FROM mechane.managed_sessions
         WHERE workspace_id=$1 AND (creator_id=$2 OR $3::boolean)
           AND (archived_at IS NULL OR $4::boolean)
           AND ($17::text IS NULL OR strpos(lower(concat_ws(' ',id,configuration->>'title')),lower($17))>0)
           AND ($5::text IS NULL OR agent_id=$5 AND ($6::int IS NULL OR agent_version=$6))
           AND ($7::text[] IS NULL OR status=ANY($7)) AND $8::text IS NULL
           AND ($9::text IS NULL OR configuration->'resources' @> jsonb_build_array(
             jsonb_build_object('type','memory_store','memory_store_id',$9::text)))
           AND ($10::timestamptz IS NULL OR created_at>=$10) AND ($11::timestamptz IS NULL OR created_at<=$11)
           AND ($12::timestamptz IS NULL OR created_at>$12) AND ($13::timestamptz IS NULL OR created_at<$13)
           AND ($14::timestamptz IS NULL OR (created_at,id)>($14,$15::text))
         ORDER BY created_at ASC, id ASC LIMIT $16`,
        parameters,
      );
    }

    return await context.client.query(
      `SELECT * FROM mechane.managed_sessions
       WHERE workspace_id=$1 AND (creator_id=$2 OR $3::boolean)
         AND (archived_at IS NULL OR $4::boolean)
         AND ($17::text IS NULL OR strpos(lower(concat_ws(' ',id,configuration->>'title')),lower($17))>0)
         AND ($5::text IS NULL OR agent_id=$5 AND ($6::int IS NULL OR agent_version=$6))
         AND ($7::text[] IS NULL OR status=ANY($7)) AND $8::text IS NULL
         AND ($9::text IS NULL OR configuration->'resources' @> jsonb_build_array(
           jsonb_build_object('type','memory_store','memory_store_id',$9::text)))
         AND ($10::timestamptz IS NULL OR created_at>=$10) AND ($11::timestamptz IS NULL OR created_at<=$11)
         AND ($12::timestamptz IS NULL OR created_at>$12) AND ($13::timestamptz IS NULL OR created_at<$13)
         AND ($14::timestamptz IS NULL OR (created_at,id)<($14,$15::text))
       ORDER BY created_at DESC, id DESC LIMIT $16`,
      parameters,
    );
  }

  const result = await querySessions();

  const rows = Schema.decodeUnknownSync(Schema.Array(SessionRow))(result.rows);
  const visible = visiblePage(rows, limit, isBackward);
  const first = visible.at(0);
  const last = visible.at(-1);
  const hasNext = isBackward || rows.length > limit;
  const hasPrevious = hasPreviousPage(isBackward, rows.length > limit, key !== null);

  const meters = await readManagedSessionUsages(context, {
    workspaceId: scope.workspaceId,
    sessionIds: visible.map((row) => row.id),
  });

  const sessions = visible.map((row) => {
    const meter = meters.get(row.id);

    if (meter === undefined) {
      throw new Error('Missing usage for a visible session');
    }

    return renderSession(row, meter);
  });

  return {
    data: sessions,
    next_page: cursor({ row: last, hasPage: hasNext, isBackward: false, order: query.order ?? 'desc' }),
    prev_page: cursor({ row: first, hasPage: hasPrevious, isBackward: true, order: query.order ?? 'desc' }),
  };
}
