import type { StoreContext } from '@mechane/authority-store';
import type { PluggableSandboxProvider } from '@mechane/sandbox-provider';
import type { InstalledAllocation, InstalledSession } from './installed-session.ts';
import { installedWorkCredential } from './installed-work-credential.ts';
import type { InstalledSigning } from './installed-work-credential.ts';
import { authorizeInstalledWork } from './installed-work-grant.ts';

type Reservation = InstalledSession & { readonly workId: string; readonly leaseId: string };

type ProviderState = {
  readonly provider: PluggableSandboxProvider;
  readonly providerSandboxId: string | null;
  readonly snapshotId: string | null;
};

type AllocationState = ProviderState & {
  readonly generation: number;
  readonly state: 'active' | 'releasing' | 'released';
};

type Generation = { readonly generation: number };
type AllocationCheck = InstalledAllocation & ProviderState & { readonly action: 'start' | 'touch' | 'release' };
type StartingWork = { readonly workId: string; readonly leaseId: string; readonly tokenHash: string };
type ReleaseTarget = InstalledSession & { readonly generation?: number };
type CheckBatch = { readonly maxRows: number; readonly release?: ReleaseTarget };

type ProviderHandleInput = InstalledAllocation & {
  readonly provider: PluggableSandboxProvider;
  readonly sandboxId: string;
};

type SnapshotInput = InstalledAllocation & { readonly snapshotId: string };

const CHECK_INTERVAL_SECONDS = 60;

export async function reserveInstalledAllocation(context: StoreContext, input: Reservation): Promise<number> {
  const result = await context.client.query<Generation>(
    `INSERT INTO mechane.managed_installed_allocations AS a
       (workspace_id,environment_id,session_id,work_id,lease_id,generation)
     VALUES ($1,$2,$3,$4,$5,1)
     ON CONFLICT (workspace_id,session_id) DO UPDATE
       SET generation=a.generation+1,work_id=excluded.work_id,lease_id=excluded.lease_id,
           next_check_at=now(),release_started_at=NULL,released_at=NULL
       WHERE a.released_at IS NOT NULL AND a.environment_id=excluded.environment_id
     RETURNING generation`,
    [input.workspaceId, input.environmentId, input.sessionId, input.workId, input.leaseId],
  );

  const row = result.rows[0];

  if (row === undefined) {
    throw new Error('The prior sandbox allocation is still held.');
  }

  return row.generation;
}

export function createInstalledAllocationStore(context: StoreContext) {
  return {
    authorizeComputer: (input: Parameters<typeof authorizeInstalledWork>[1]) => authorizeInstalledWork(context, input),
    async status(input: InstalledSession): Promise<AllocationState | null> {
      const result = await context.client.query<AllocationState>(
        `SELECT generation::float8 AS generation,
                provider,provider_sandbox_id AS "providerSandboxId",snapshot_id AS "snapshotId",
                CASE WHEN released_at IS NOT NULL THEN 'released'
                     WHEN release_started_at IS NOT NULL THEN 'releasing' ELSE 'active' END AS state
           FROM mechane.managed_installed_allocations
          WHERE workspace_id=$1 AND environment_id=$2 AND session_id=$3`,
        [input.workspaceId, input.environmentId, input.sessionId],
      );

      return result.rows[0] ?? null;
    },
    async due({ maxRows, release }: CheckBatch): Promise<ReadonlyArray<AllocationCheck>> {
      const result = await context.client.query<AllocationCheck>(
        `WITH due AS MATERIALIZED (
           SELECT a.workspace_id,a.session_id,a.lease_id,a.work_id,a.release_started_at
           FROM mechane.managed_installed_allocations a
           WHERE a.released_at IS NULL AND (
             ($3::uuid IS NULL AND a.next_check_at<=now())
             OR (a.workspace_id=$3 AND a.environment_id=$4 AND a.session_id=$5
                 AND ($6::bigint IS NULL OR a.generation=$6)))
           ORDER BY a.next_check_at,a.workspace_id,a.session_id LIMIT $1 FOR UPDATE SKIP LOCKED),
         leases AS MATERIALIZED (
           SELECT w.id,w.lease_id,w.state,w.lease_until FROM mechane.managed_work w JOIN due ON w.id=due.work_id
           FOR UPDATE OF w),
         checks AS (
           SELECT due.workspace_id,due.session_id,w.state,
             (due.release_started_at IS NOT NULL OR w.id IS NULL OR w.lease_id IS DISTINCT FROM due.lease_id
              OR w.state IN ('queued','stopped') OR w.lease_until IS NULL OR w.lease_until<=clock_timestamp())
               AS should_release FROM due LEFT JOIN leases w ON w.id=due.work_id)
         UPDATE mechane.managed_installed_allocations a
           SET next_check_at=now()+$2*interval '1 second',
               release_started_at=CASE WHEN checks.should_release THEN coalesce(a.release_started_at,now()) END
           FROM checks WHERE (a.workspace_id,a.session_id)=(checks.workspace_id,checks.session_id)
             AND ($3::uuid IS NULL OR checks.should_release)
         RETURNING a.workspace_id AS "workspaceId",a.environment_id AS "environmentId",a.session_id AS "sessionId",
           a.generation::float8 AS generation,a.provider,a.provider_sandbox_id AS "providerSandboxId",
           a.snapshot_id AS "snapshotId",
           CASE WHEN checks.should_release THEN 'release'
             WHEN checks.state='starting' THEN 'start' ELSE 'touch' END AS action`,
        [
          maxRows,
          CHECK_INTERVAL_SECONDS,
          release?.workspaceId,
          release?.environmentId,
          release?.sessionId,
          release?.generation,
        ],
      );

      return result.rows;
    },
    async recordProviderHandle({
      workspaceId,
      environmentId,
      sessionId,
      generation,
      provider,
      sandboxId,
    }: ProviderHandleInput): Promise<void> {
      await context.client.query(
        `UPDATE mechane.managed_installed_allocations
            SET provider=$5,provider_sandbox_id=$6
          WHERE workspace_id=$1 AND environment_id=$2 AND session_id=$3 AND generation=$4`,
        [workspaceId, environmentId, sessionId, generation, provider, sandboxId],
      );
    },
    async recordSnapshot({
      workspaceId,
      environmentId,
      sessionId,
      generation,
      snapshotId,
    }: SnapshotInput): Promise<void> {
      await context.client.query(
        `UPDATE mechane.managed_installed_allocations
            SET snapshot_id=$5
          WHERE workspace_id=$1 AND environment_id=$2 AND session_id=$3 AND generation=$4`,
        [workspaceId, environmentId, sessionId, generation, snapshotId],
      );
    },
    async resumeStartup(input: InstalledAllocation & InstalledSigning) {
      const result = await context.client.query<StartingWork>(
        `SELECT w.id AS "workId",w.lease_id AS "leaseId",w.token_hash AS "tokenHash"
         FROM mechane.managed_installed_allocations a JOIN mechane.managed_work w
           ON a.work_id=w.id AND a.lease_id=w.lease_id
         JOIN mechane.managed_sessions s ON s.workspace_id=a.workspace_id AND s.id=a.session_id
           AND s.environment_id=a.environment_id AND s.status<>'terminated' AND s.archived_at IS NULL
         WHERE a.workspace_id=$1 AND a.environment_id=$2 AND a.session_id=$3 AND a.generation=$4
           AND a.release_started_at IS NULL AND a.released_at IS NULL
           AND w.state='starting' AND w.lease_until>clock_timestamp() AND NOT w.effects_exposed`,
        [input.workspaceId, input.environmentId, input.sessionId, input.generation],
      );

      const row = result.rows[0];

      if (row === undefined) {
        return null;
      }

      const credential = installedWorkCredential({ ...input, leaseId: row.leaseId });

      if (credential.digest !== row.tokenHash) {
        return null;
      }

      return { workId: row.workId, workSecret: credential.secret };
    },
    async confirmRelease(input: InstalledAllocation): Promise<void> {
      await context.client.query(
        `WITH released AS (
           UPDATE mechane.managed_installed_allocations SET released_at=now()
           WHERE workspace_id=$1 AND environment_id=$2 AND session_id=$3 AND generation=$4
             AND release_started_at IS NOT NULL AND released_at IS NULL
           RETURNING work_id,lease_id)
         UPDATE mechane.managed_work w SET state='stopped',stopped_at=coalesce(w.stopped_at,now())
         FROM released WHERE (w.id,w.lease_id)=(released.work_id,released.lease_id)
           AND w.state='active' AND NOT w.effects_exposed AND w.lease_until<=clock_timestamp()`,
        [input.workspaceId, input.environmentId, input.sessionId, input.generation],
      );
    },
  };
}
