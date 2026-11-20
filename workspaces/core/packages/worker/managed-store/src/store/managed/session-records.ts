import { ManagedStoreError, readManagedSessionUsage, StoredText as Text } from '@mechane/authority-store';
import type { ManagedDocument, ManagedScope, StoreContext } from '@mechane/authority-store';
import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { describeMemoryMounts } from './memory-stores.ts';
import { describeSkillMounts } from './skill-mounts.ts';

const Document = Schema.Record(Text, Schema.Unknown);

const Configuration = Schema.Struct({
  agent: Document,
  metadata: Schema.Record(Text, Text),
  title: Schema.NullOr(Text),
  resources: Schema.Array(Document),
  vault_ids: Schema.Array(Text),
});

export const SessionRow = Schema.Struct({
  id: Text,
  workspace_id: Text,
  creator_id: Text,
  agent_id: Text,
  agent_version: Schema.Number,
  environment_id: Text,
  runtime_mech_id: Text,
  thread_id: Text,
  configuration: Configuration,
  child_runtime_mech_ids: Schema.Record(Text, Text),
  outcome_evaluations: Schema.Array(Document),
  status: Schema.Literals(['running', 'idle', 'terminated']),
  status_at: Text,

  initial_events: Schema.NullOr(Schema.Array(Document)),
  created_at: Text,
  updated_at: Text,
  archived_at: Schema.NullOr(Text),
});

export type SessionRow = typeof SessionRow.Type;
export type SessionIdentity = { readonly scope: ManagedScope; readonly id: string };
export type SessionStatus = SessionRow['status'];
const MILLISECONDS_PER_SECOND = 1000;

export async function readSession(
  context: StoreContext,
  { scope, id }: SessionIdentity,
  isUpdate = false,
): Promise<SessionRow> {
  const values = [scope.workspaceId, scope.principalId, scope.isAdmin, id];

  async function query() {
    if (isUpdate) {
      return await context.client.query(
        'SELECT * FROM mechane.managed_sessions WHERE workspace_id=$1 AND (creator_id=$2 OR $3::boolean) AND id=$4 FOR UPDATE',
        values,
      );
    }

    return await context.client.query(
      'SELECT * FROM mechane.managed_sessions WHERE workspace_id=$1 AND (creator_id=$2 OR $3::boolean) AND id=$4',
      values,
    );
  }

  const result = await query();

  if (result.rows.length === 0) {
    throw new ManagedStoreError(HttpStatusCode.NotFound, 'Session not found');
  }

  return Schema.decodeUnknownSync(SessionRow)(result.rows[0]);
}

type Meter = Awaited<ReturnType<typeof readManagedSessionUsage>>;

function elapsedUntil(row: SessionRow, statusTime: number): number {
  if (row.status === 'terminated') {
    return statusTime;
  }

  return Date.now();
}

export function renderSession(row: SessionRow, { usage, budget, threadActiveSeconds }: Meter): ManagedDocument {
  const statusTime = Date.parse(row.status_at);
  const finalTime = elapsedUntil(row, statusTime);
  const durationSeconds = Math.max(0, finalTime - Date.parse(row.created_at)) / MILLISECONDS_PER_SECOND;

  return {
    ...row.configuration,
    id: row.id,
    type: 'session',
    environment_id: row.environment_id,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
    deployment_id: null,
    stats: { duration_seconds: durationSeconds, active_seconds: threadActiveSeconds },
    outcome_evaluations: row.outcome_evaluations,
    usage,
    budget,
  };
}

export async function sessionDocument(context: StoreContext, row: SessionRow): Promise<ManagedDocument> {
  const meter = await readManagedSessionUsage(context, { workspaceId: row.workspace_id, sessionId: row.id });

  return renderSession(row, meter);
}

async function buildOpenDescriptor(
  context: StoreContext,
  row: SessionRow,
  initialEvents: ReadonlyArray<ManagedDocument>,
) {
  return {
    id: row.id,
    creatorId: row.creator_id,
    createdAt: row.created_at,
    childRuntimeMechIds: row.child_runtime_mech_ids,
    workspaceId: row.workspace_id,
    agentId: row.agent_id,
    runtimeMechId: row.runtime_mech_id,
    threadId: row.thread_id,
    environmentId: row.environment_id,
    agent: row.configuration.agent,
    memoryInstructions: describeMemoryMounts(row.configuration.resources),
    skillInstructions: await describeSkillMounts({
      context,
      workspaceId: row.workspace_id,
      agent: row.configuration.agent,
    }),
    initialEvents,
    isArchived: row.archived_at !== null || row.status === 'terminated',
  };
}

export async function openDescriptor(context: StoreContext, row: SessionRow) {
  if (row.initial_events === null) {
    return null;
  }

  return await buildOpenDescriptor(context, row, row.initial_events);
}

export async function reopenDescriptor(context: StoreContext, row: SessionRow) {
  return await buildOpenDescriptor(context, row, []);
}

type WorkerResourceScope = { readonly workspaceId: string; readonly sessionId: string };

export async function readWorkerSessionResources(
  context: StoreContext,
  scope: WorkerResourceScope,
): Promise<ReadonlyArray<ManagedDocument>> {
  const result = await context.client.query(
    `SELECT configuration->'resources' AS resources FROM mechane.managed_sessions
     WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL AND status<>'terminated' FOR SHARE`,
    [scope.workspaceId, scope.sessionId],
  );

  if (result.rows.length === 0) {
    throw new ManagedStoreError(HttpStatusCode.NotFound, 'Session not found');
  }

  return Schema.decodeUnknownSync(Schema.Struct({ resources: Schema.Array(Document) }))(result.rows[0]).resources;
}
