import { Schema } from 'effect';
import { createHash, randomBytes } from 'node:crypto';
import type { StoreContext } from '../context.ts';
import { StoredText, StoredTimestamp } from '../row-values.ts';
import { isInstalledEnvironment } from './installed-session.ts';
import type { InstalledSession } from './installed-session.ts';
import { managedId } from './managed-record.ts';

export const WORK_TOKEN_PREFIX = 'sk-ant-req-';
export const DEFAULT_LEASE_SECONDS = 60;
const TOKEN_RANDOM_BYTES = 32;

export type WorkEnvironment = { readonly workspaceId: string; readonly environmentId: string };
export type WorkLocator = WorkEnvironment & { readonly workId: string };
export type SessionWork = { readonly workspaceId: string; readonly sessionId: string };
type InstalledDemand = InstalledSession & { readonly isRecoveringLease: boolean };
export type WorkPoll = WorkEnvironment & { readonly reclaimAfterMilliseconds: number; readonly origin: string };
export type WorkPage = WorkEnvironment & { readonly maxRows: number; readonly page: string | null };

export type WorkCredential = {
  readonly workspaceId: string;
  readonly principalId: string;
  readonly sessionId: string;
  readonly environmentId: string;
  readonly workId: string;
  readonly leaseId: string;
};

export type WorkMetadata = Readonly<Record<string, string | null>>;

export type WorkHeartbeat = WorkLocator & {
  readonly expected: string | null;
  readonly ttlSeconds: number;
  readonly tokenHash: string | null;
};

export type WorkStop = WorkLocator & { readonly shouldForce: boolean; readonly tokenHash: string | null };
const NullableTime = Schema.NullOr(StoredTimestamp);

const WorkRecord = Schema.Struct({
  id: StoredText,
  environment_id: StoredText,
  session_id: StoredText,
  state: Schema.Literals(['queued', 'starting', 'active', 'stopping', 'stopped']),
  metadata: Schema.Record(StoredText, StoredText),
  created_at: StoredTimestamp,
  acknowledged_at: NullableTime,
  started_at: NullableTime,
  latest_heartbeat_at: NullableTime,
  stop_requested_at: NullableTime,
  stopped_at: NullableTime,
});

export type WorkRow = typeof WorkRecord.Type;

export function digestWorkToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function encodeWorkSecret(origin: string, token: string): string {
  const payload = JSON.stringify({ sessions_token: token, api_base_url: origin });

  return btoa(payload).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function makeWorkSecret(origin: string) {
  const token = WORK_TOKEN_PREFIX + randomBytes(TOKEN_RANDOM_BYTES).toString('base64url');
  const secret = encodeWorkSecret(origin, token);

  return { secret, digest: digestWorkToken(token) };
}

export function presentWork(raw: unknown, secret: string | null = null) {
  const row = Schema.decodeUnknownSync(WorkRecord)(raw);

  return {
    type: 'work' as const,
    id: row.id,
    environment_id: row.environment_id,
    data: { type: 'session' as const, id: row.session_id },
    state: row.state,
    metadata: row.metadata,
    created_at: row.created_at,
    acknowledged_at: row.acknowledged_at,
    started_at: row.started_at,
    latest_heartbeat_at: row.latest_heartbeat_at,
    stop_requested_at: row.stop_requested_at,
    stopped_at: row.stopped_at,
    secret,
  };
}

export async function closeSessionWork(
  transaction: StoreContext,
  { workspaceId, sessionId }: SessionWork,
): Promise<void> {
  await transaction.client.query(
    `UPDATE mechane.managed_work SET state='stopped',stop_requested_at=COALESCE(stop_requested_at,now()),
       stopped_at=COALESCE(stopped_at,now()),effects_exposed=false
     WHERE workspace_id=$1 AND session_id=$2 AND (stopped_at IS NULL OR effects_exposed)`,
    [workspaceId, sessionId],
  );
}

export async function registerManagedSessionWork(
  transaction: StoreContext,
  input: SessionWork,
): Promise<InstalledDemand | null> {
  const live = await transaction.client.query<{ readonly environment_id: string }>(
    `SELECT environment_id FROM mechane.managed_sessions
     WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL AND status<>'terminated' FOR SHARE`,
    [input.workspaceId, input.sessionId],
  );

  const session = live.rows[0];

  if (session === undefined) {
    return null;
  }

  await transaction.client.query(
    `UPDATE mechane.managed_work SET state='stopped',stopped_at=now()
     WHERE workspace_id=$1 AND session_id=$2 AND lease_until<=clock_timestamp() AND (
       state='stopping' OR (installation_owned AND state='active' AND NOT effects_exposed))`,
    [input.workspaceId, input.sessionId],
  );

  const ready = await transaction.client.query<{ readonly isReady: boolean; readonly isRecoveringLease: boolean }>(
    `WITH lost AS (
       SELECT id FROM mechane.managed_work WHERE workspace_id=$2 AND session_id=$4 AND installation_owned
         AND effects_exposed AND (stopped_at IS NOT NULL OR lease_until<=clock_timestamp())
     ), admitted AS (
       INSERT INTO mechane.managed_work(id,workspace_id,environment_id,session_id)
       SELECT $1,$2,$3,$4 WHERE NOT EXISTS (SELECT 1 FROM lost)
       ON CONFLICT(workspace_id,session_id) WHERE stopped_at IS NULL DO NOTHING
       RETURNING id
     )
     SELECT EXISTS (SELECT 1 FROM lost) AS "isRecoveringLease",
       (EXISTS (SELECT 1 FROM admitted) OR EXISTS (
         SELECT 1 FROM mechane.managed_work WHERE workspace_id=$2 AND session_id=$4 AND stopped_at IS NULL
           AND (state='queued' OR (installation_owned AND state='starting' AND NOT effects_exposed)
             OR lease_until<=clock_timestamp()))) AS "isReady"`,
    [managedId('work'), input.workspaceId, session.environment_id, input.sessionId],
  );

  const target = { ...input, environmentId: session.environment_id };
  const row = ready.rows[0];

  if (row !== undefined && isInstalledEnvironment(target)) {
    if (row.isReady || row.isRecoveringLease) {
      return { ...target, isRecoveringLease: row.isRecoveringLease };
    }
  }

  return null;
}
