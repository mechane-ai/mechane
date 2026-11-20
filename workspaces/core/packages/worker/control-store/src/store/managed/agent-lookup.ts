import { HttpStatusCode } from '@mechane/records';
import type { StoreContext } from '../context.ts';
import { decodePage, encodePage, ManagedStoreError, pageSize } from './managed-record.ts';
import type { ManagedDocument, ManagedPage, ManagedPageQuery, ManagedScope } from './types.ts';

export type AgentLookup = { readonly scope: ManagedScope; readonly id: string; readonly version?: number | undefined };

export type AgentRow = {
  readonly id: string;
  readonly runtime_id: string;
  readonly created_at: string;
  readonly archived_at: string | null;
  readonly definition: ManagedDocument;
  readonly version: number;
  readonly updated_at: string;
};

export async function loadAgent(
  context: StoreContext,
  { scope, id, version }: AgentLookup,
  shouldLock = false,
): Promise<AgentRow> {
  if (shouldLock) {
    await context.client.query(
      'SELECT id FROM mechane.managed_agents WHERE workspace_id=$1 AND (creator_id=$2 OR $3) AND id=$4 FOR UPDATE',
      [scope.workspaceId, scope.principalId, scope.isAdmin, id],
    );
  }

  const result = await context.client.query<AgentRow>(
    `
    SELECT a.id,a.runtime_id,a.created_at,a.archived_at,v.version,v.definition,v.updated_at
    FROM mechane.managed_agents a JOIN mechane.managed_agent_versions v
      ON v.agent_id=a.id AND v.version=COALESCE($5::int,a.version)
    WHERE a.workspace_id=$1 AND (a.creator_id=$2 OR $3) AND a.id=$4`,
    [scope.workspaceId, scope.principalId, scope.isAdmin, id, version ?? null],
  );

  const row = result.rows[0];

  if (row === undefined) {
    throw new ManagedStoreError(HttpStatusCode.NotFound, 'Agent or version not found');
  }

  return row;
}

export function publicAgent(row: AgentRow): ManagedDocument {
  return {
    ...row.definition,
    id: row.id,
    type: 'agent',
    version: row.version,
    archived_at: row.archived_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

type AgentPageInput = {
  readonly rows: ReadonlyArray<AgentRow>;
  readonly maxRows: number;
  readonly cursorFor: (row: AgentRow) => { readonly id: string; readonly createdAt: string };
};

function agentPage({ rows, maxRows, cursorFor }: AgentPageInput): ManagedPage {
  const visible = rows.slice(0, maxRows);
  const agents = visible.map(publicAgent);
  const last = visible.at(-1);

  if (rows.length <= maxRows || last === undefined) {
    return { data: agents, next_page: null };
  }

  return { data: agents, next_page: encodePage(cursorFor(last)) };
}

type ListInput = { readonly scope: ManagedScope; readonly query?: ManagedPageQuery };

type AgentListInput = {
  readonly scope: ManagedScope;
  readonly query?: ManagedPageQuery & { readonly search?: string; readonly filter?: 'active' | 'archived' };
};

export async function listAgents(context: StoreContext, { scope, query = {} }: AgentListInput): Promise<ManagedPage> {
  const limit = pageSize(query);
  const cursor = decodePage(query.page);

  const result = await context.client.query<AgentRow>(
    `
    SELECT a.id,a.runtime_id,a.created_at,a.archived_at,v.version,v.definition,v.updated_at
    FROM mechane.managed_agents a JOIN mechane.managed_agent_versions v ON v.agent_id=a.id AND v.version=a.version
    WHERE a.workspace_id=$1 AND (a.creator_id=$2 OR $3)
      AND CASE WHEN $10::text IS NULL THEN (a.archived_at IS NULL OR $4)
        ELSE (a.archived_at IS NOT NULL)=($10='archived') END
      AND ($11::text IS NULL OR strpos(lower(concat_ws(' ',a.id,v.definition->>'name',v.definition#>>'{model,id}',v.version)),lower($11))>0)
      AND ($5::timestamptz IS NULL OR a.created_at >= $5) AND ($6::timestamptz IS NULL OR a.created_at <= $6)
      AND ($7::timestamptz IS NULL OR (a.created_at,a.id) < ($7,$8))
    ORDER BY a.created_at DESC,a.id DESC LIMIT $9`,
    [
      scope.workspaceId,
      scope.principalId,
      scope.isAdmin,
      query.includeArchived ?? false,
      query.createdAfter ?? null,
      query.createdBefore ?? null,
      cursor?.createdAt ?? null,
      cursor?.id ?? null,
      limit + 1,
      query.filter ?? null,
      query.search?.trim() ?? null,
    ],
  );

  return agentPage({
    rows: result.rows,
    maxRows: limit,
    cursorFor: (row) => ({ id: row.id, createdAt: row.created_at }),
  });
}

export async function listAgentVersions(
  context: StoreContext,
  { scope, id, query = {} }: ListInput & { readonly id: string },
): Promise<ManagedPage> {
  await loadAgent(context, { scope, id });

  const cursor = decodePage(query.page);
  const limit = pageSize(query);

  if (cursor !== null && !/^[1-9][0-9]{0,8}$/.test(cursor.id)) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid agent version cursor');
  }

  const result = await context.client.query<AgentRow>(
    `
    SELECT a.id,a.runtime_id,a.created_at,a.archived_at,v.version,v.definition,v.updated_at
    FROM mechane.managed_agents a JOIN mechane.managed_agent_versions v ON v.agent_id=a.id
    WHERE a.workspace_id=$1 AND (a.creator_id=$2 OR $3) AND a.id=$4 AND ($5::int IS NULL OR v.version < $5)
    ORDER BY v.version DESC LIMIT $6`,
    [scope.workspaceId, scope.principalId, scope.isAdmin, id, cursor?.id ?? null, limit + 1],
  );

  return agentPage({
    rows: result.rows,
    maxRows: limit,
    cursorFor: (row) => ({ id: String(row.version), createdAt: row.updated_at }),
  });
}
