import { decodePage, encodePage } from '@mechane/authority-store';
import type { ManagedScope, StoreContext } from '@mechane/authority-store';
import { claimInstalledWork } from './claim-installed-work.ts';
import { createManagedEnvironmentStore } from './environments.ts';
import { createInstalledAllocationStore } from './installed-allocations.ts';
import { createWorkClaims } from './work-claims.ts';
import { createWorkLossStore } from './work-losses.ts';
import { digestWorkToken, presentWork, registerManagedSessionWork } from './work-records.ts';
import type { SessionWork, WorkCredential, WorkEnvironment, WorkMetadata, WorkPage, WorkRow } from './work-records.ts';

type TokenLocator = { readonly token: string; readonly purpose?: 'access' | 'result' | 'lifecycle' };
type ViewWork = { readonly scope: ManagedScope; readonly environmentId: string; readonly workId: string };

export function createManagedWorkerStore(context: StoreContext) {
  return {
    allocations: createInstalledAllocationStore(context),
    environments: createManagedEnvironmentStore(context),
    ...createWorkClaims(context),
    async ensureSessionWork(input: SessionWork) {
      return await context.atomic(async (transaction) => await registerManagedSessionWork(transaction, input));
    },
    async isLeaseActive(input: SessionWork & { readonly leaseId: string }): Promise<boolean> {
      const result = await context.client.query(
        `SELECT id FROM mechane.managed_work w WHERE workspace_id=$1 AND session_id=$2 AND lease_id=$3
         AND state IN ('starting','active') AND lease_until>clock_timestamp() AND mechane.workspace_allows_worker_effect(w.workspace_id,w.installation_owned)`,
        [input.workspaceId, input.sessionId, input.leaseId],
      );

      return result.rowCount === 1;
    },
    losses: createWorkLossStore(context),
    claimInstalledWork: (input: Parameters<typeof claimInstalledWork>[1]) => claimInstalledWork(context, input),
    async tokenScope({ token, purpose = 'access' }: TokenLocator): Promise<WorkCredential | null> {
      const digest = digestWorkToken(token);

      const result = await context.client.query<WorkCredential>(
        `UPDATE mechane.managed_work w SET effects_exposed=(w.effects_exposed OR $2='access')
         FROM mechane.managed_sessions s WHERE s.workspace_id=w.workspace_id AND s.id=w.session_id
           AND w.token_hash=$1 AND w.lease_until>clock_timestamp() AND ($2<>'access' OR mechane.workspace_allows_worker_effect(w.workspace_id,w.installation_owned))
           AND ($2='lifecycle' OR (s.archived_at IS NULL
             AND s.status<>'terminated' AND w.state IN ('starting','active','stopping')))
         RETURNING w.id AS "workId",w.lease_id AS "leaseId",w.workspace_id AS "workspaceId",w.environment_id AS "environmentId",
                   w.session_id AS "sessionId",s.creator_id AS "principalId"`,
        [digest, purpose],
      );

      return result.rows[0] ?? null;
    },
    async list(input: WorkPage) {
      const key = decodePage(input.page ?? undefined);

      const result = await context.client.query<WorkRow>(
        `SELECT * FROM mechane.managed_work WHERE workspace_id=$1 AND environment_id=$2
         AND ($3::timestamptz IS NULL OR (created_at,id)<($3,$4)) ORDER BY created_at DESC,id DESC LIMIT $5`,
        [input.workspaceId, input.environmentId, key?.createdAt ?? null, key?.id ?? null, input.maxRows + 1],
      );

      const rows = result.rows.slice(0, input.maxRows);
      const tail = rows.at(-1);
      const items = rows.map((row) => presentWork(row));

      if (result.rows.length <= input.maxRows || tail === undefined) {
        return { data: items, next_page: null };
      }

      const nextPage = encodePage({ createdAt: tail.created_at, id: tail.id });

      return { data: items, next_page: nextPage };
    },
    async get({ scope, environmentId, workId }: ViewWork) {
      const result = await context.client.query<WorkRow>(
        `SELECT w.* FROM mechane.managed_work w JOIN mechane.managed_sessions s
         ON w.workspace_id=s.workspace_id AND w.session_id=s.id WHERE w.workspace_id=$1 AND w.environment_id=$2 AND w.id=$3
         AND ($4 OR s.creator_id=$5)`,
        [scope.workspaceId, environmentId, workId, scope.isAdmin, scope.principalId],
      );

      const row = result.rows[0];

      if (row === undefined) {
        return null;
      }

      return presentWork(row);
    },
    async update({ scope, environmentId, workId, metadata }: ViewWork & { readonly metadata: WorkMetadata }) {
      const result = await context.client.query<WorkRow>(
        `UPDATE mechane.managed_work w SET metadata=(SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) FROM jsonb_each(w.metadata || $6::jsonb) WHERE value <> 'null'::jsonb AND value <> '""'::jsonb)
         FROM mechane.managed_sessions s WHERE w.workspace_id=s.workspace_id AND w.session_id=s.id AND w.workspace_id=$1
           AND w.environment_id=$2 AND w.id=$3 AND ($4 OR s.creator_id=$5) RETURNING w.*`,
        [scope.workspaceId, environmentId, workId, scope.isAdmin, scope.principalId, JSON.stringify(metadata)],
      );

      const row = result.rows[0];

      if (row === undefined) {
        return null;
      }

      return presentWork(row);
    },
    async observePoll(input: WorkEnvironment & { readonly workerId: string }) {
      await context.client.query(
        `WITH pruned AS (DELETE FROM mechane.managed_worker_polls
         WHERE environment_id=$1 AND observed_at<now()-interval '30 seconds')
         INSERT INTO mechane.managed_worker_polls(environment_id,worker_id) VALUES($1,$2)
         ON CONFLICT(environment_id,worker_id) DO UPDATE SET observed_at=now()`,
        [input.environmentId, input.workerId],
      );
    },
    async stats(input: WorkEnvironment) {
      const result = await context.client.query<{
        readonly depth: number;
        readonly pending: number;
        readonly oldest_queued_at: string | null;
        readonly workers_polling: number | null;
      }>(
        `SELECT count(*) FILTER(WHERE polled_at IS NULL)::int AS depth,
            count(*) FILTER(WHERE polled_at IS NOT NULL)::int AS pending, min(created_at) AS oldest_queued_at,
            (SELECT nullif(count(*),0)::int FROM mechane.managed_worker_polls
             WHERE environment_id=$2 AND observed_at >= now()-interval '30 seconds') AS workers_polling
         FROM mechane.managed_work WHERE workspace_id=$1 AND environment_id=$2 AND state='queued'`,
        [input.workspaceId, input.environmentId],
      );

      return { type: 'work_queue_stats' as const, ...result.rows[0] };
    },
    digestWorkToken,
  };
}
