import type { StoreContext } from '../context.ts';
import type { WorkEnvironment } from './work-records.ts';

type LossLookup = WorkEnvironment & { readonly sessionId?: string; readonly maxRows: number };

type LostLease = WorkEnvironment & {
  readonly sessionId: string;
  readonly agentId: string;
  readonly workId: string;
  readonly leaseId: string;
};

export function createWorkLossStore(context: StoreContext) {
  return {
    async pending(input: LossLookup) {
      const result = await context.client.query<LostLease>(
        `SELECT w.id AS "workId",w.workspace_id AS "workspaceId",w.environment_id AS "environmentId",
             w.session_id AS "sessionId",s.agent_id AS "agentId",w.lease_id AS "leaseId"
         FROM mechane.managed_work w JOIN mechane.managed_sessions s ON s.id=w.session_id AND s.workspace_id=w.workspace_id
         WHERE w.workspace_id=$1 AND w.environment_id=$2 AND ($3::text IS NULL OR w.session_id=$3)
           AND w.effects_exposed AND w.lease_id IS NOT NULL AND (w.stopped_at IS NOT NULL OR w.lease_until<=clock_timestamp())
         ORDER BY w.lease_until,w.id LIMIT $4`,
        [input.workspaceId, input.environmentId, input.sessionId ?? null, input.maxRows],
      );

      return result.rows;
    },
    async clear(input: LostLease): Promise<void> {
      await context.client.query(
        `UPDATE mechane.managed_work SET effects_exposed=false, token_hash=NULL, lease_id=NULL, lease_until=NULL,
            polled_at=NULL, started_at=NULL, acknowledged_at=NULL,latest_heartbeat_at=NULL,
            state=CASE WHEN installation_owned OR stop_requested_at IS NOT NULL THEN 'stopped' ELSE 'queued' END,
            stopped_at=CASE WHEN installation_owned OR stop_requested_at IS NOT NULL THEN coalesce(stopped_at,now()) END
         WHERE id=$1 AND workspace_id=$2 AND session_id=$3 AND lease_id=$4 AND effects_exposed
           AND (stopped_at IS NOT NULL OR lease_until<=clock_timestamp())`,
        [input.workId, input.workspaceId, input.sessionId, input.leaseId],
      );
    },
  };
}
