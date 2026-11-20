import type { StoreContext } from '@mechane/authority-store';
import { expireUnstartedAllocation, installedDrainInventory } from './installed-drain.ts';
import type { InstalledAllocation, InstalledSession } from './installed-session.ts';

type PendingWorkInput = { readonly maxRows: number };

export function createInstalledEnvironmentStore(context: StoreContext) {
  return {
    expireUnstarted: (allocation: InstalledAllocation) => expireUnstartedAllocation(context, allocation),
    drainInventory: (input: PendingWorkInput) => installedDrainInventory(context, input),
    async pending({ maxRows }: PendingWorkInput): Promise<ReadonlyArray<InstalledSession>> {
      const result = await context.client.query<InstalledSession>(
        `WITH held AS (
           SELECT workspace_id FROM mechane.sandbox_capacity WHERE state='held'
           UNION ALL SELECT workspace_id FROM mechane.managed_installed_allocations WHERE released_at IS NULL
         ), occupancy AS (
           SELECT workspace_id, count(*) AS machines FROM held GROUP BY workspace_id
         ), candidates AS (
           SELECT w.workspace_id, w.environment_id, w.session_id, w.created_at, w.id,
                  row_number() OVER (PARTITION BY w.workspace_id ORDER BY w.created_at,w.id) AS position
           FROM mechane.managed_work w JOIN mechane.workspaces space ON space.id=w.workspace_id
           JOIN mechane.managed_sessions s ON (s.workspace_id,s.id)=(w.workspace_id,w.session_id)
           LEFT JOIN occupancy ON occupancy.workspace_id=w.workspace_id
           WHERE w.environment_id='env_' || replace(w.workspace_id::text,'-','') AND (
             (w.effects_exposed AND w.lease_id IS NOT NULL AND (w.stopped_at IS NOT NULL OR w.lease_until<=now()))
             OR (s.archived_at IS NULL AND s.status<>'terminated' AND w.state IN ('queued','starting') AND (w.lease_until IS NULL OR w.lease_until<=now())
               AND NOT coalesce((space.policy->>'isSuspended')::boolean,false)
               AND coalesce((space.policy->>'hasSandboxes')::boolean,true)
               AND coalesce(occupancy.machines,0)<coalesce((space.policy->>'machines')::int,1)
               AND NOT EXISTS (SELECT 1 FROM mechane.managed_installed_allocations a
                 WHERE (a.workspace_id,a.session_id)=(w.workspace_id,w.session_id) AND a.released_at IS NULL))))
         SELECT workspace_id AS "workspaceId", environment_id AS "environmentId", session_id AS "sessionId"
         FROM candidates ORDER BY position,created_at,id LIMIT $1`,
        [maxRows],
      );

      return result.rows;
    },
  };
}
