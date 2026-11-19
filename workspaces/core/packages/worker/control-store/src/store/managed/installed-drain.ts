import type { StoreContext } from '../context.ts';
import type { InstalledAllocation } from './installed-session.ts';

type DrainEntry = InstalledAllocation & { readonly phase: 'working' | 'stopping' | 'saving' };

export async function installedDrainInventory(context: StoreContext, { maxRows }: { readonly maxRows: number }) {
  const result = await context.client.query<DrainEntry>(
    `SELECT a.workspace_id AS "workspaceId",a.environment_id AS "environmentId",a.session_id AS "sessionId",
            a.generation::float8 AS generation,
            CASE WHEN a.release_started_at IS NOT NULL OR w.id IS NULL OR w.state IN ('stopped','queued')
                        OR w.lease_until IS NULL OR w.lease_until<=statement_timestamp() THEN 'saving'
                 WHEN w.state='stopping' OR (w.state='starting' AND NOT w.effects_exposed
                        AND w.latest_heartbeat_at IS NULL) THEN 'stopping' ELSE 'working' END AS phase
       FROM mechane.managed_installed_allocations a
       LEFT JOIN mechane.managed_work w ON (w.id,w.lease_id)=(a.work_id,a.lease_id)
      WHERE a.released_at IS NULL
      ORDER BY phase,a.workspace_id,a.session_id LIMIT $1`,
    [maxRows + 1],
  );

  return { pending: result.rows.slice(0, maxRows), hasMore: result.rows.length > maxRows };
}

export async function expireUnstartedAllocation(context: StoreContext, allocation: InstalledAllocation): Promise<void> {
  await context.client.query(
    `UPDATE mechane.managed_work w SET lease_until=clock_timestamp()
       FROM mechane.managed_installed_allocations a
      WHERE a.workspace_id=$1 AND a.environment_id=$2 AND a.session_id=$3 AND a.generation=$4
        AND a.released_at IS NULL AND (w.id,w.lease_id)=(a.work_id,a.lease_id)
        AND w.state='starting' AND w.latest_heartbeat_at IS NULL AND NOT w.effects_exposed
        AND w.lease_until>clock_timestamp()`,
    [allocation.workspaceId, allocation.environmentId, allocation.sessionId, allocation.generation],
  );
}
