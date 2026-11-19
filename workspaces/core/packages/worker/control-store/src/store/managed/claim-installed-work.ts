import { createWorkspaceRecords } from '../api/configuration/workspaces.ts';
import type { StoreContext } from '../context.ts';
import { countHeldSandboxes } from '../held-sandboxes.ts';
import { reserveInstalledAllocation } from './installed-allocations.ts';
import { isInstalledEnvironment } from './installed-session.ts';
import { installedWorkCredential } from './installed-work-credential.ts';
import type { InstalledSigning } from './installed-work-credential.ts';
import { managedId } from './managed-record.ts';
import type { WorkEnvironment } from './work-records.ts';

type InstalledClaim = WorkEnvironment &
  InstalledSigning & { readonly sessionId: string; readonly maximumMachines: number };

const STARTUP_TTL_SECONDS = 300;

export async function claimInstalledWork(context: StoreContext, input: InstalledClaim) {
  if (!isInstalledEnvironment(input)) {
    return null;
  }

  return await context.atomic(async (transaction) => {
    await transaction.client.query("SELECT pg_advisory_xact_lock(hashtext('mechane-machine-capacity'))");

    const policy = await createWorkspaceRecords(transaction).getRuntimePolicy(input);

    if (policy === null || policy.isSuspended || !policy.hasSandboxes) {
      return null;
    }

    const allocation = await countHeldSandboxes(transaction, input.workspaceId);

    if (allocation.held_machines >= input.maximumMachines || allocation.workspace_machines >= policy.machines) {
      return null;
    }

    const leaseId = managedId('lease');
    const secret = installedWorkCredential({ ...input, leaseId });

    const result = await transaction.client.query<{ readonly id: string }>(
      `UPDATE mechane.managed_work w SET state='starting',installation_owned=true,token_hash=$4,lease_id=$6,
         polled_at=now(),acknowledged_at=now(),started_at=NULL,latest_heartbeat_at=NULL,
         lease_until=clock_timestamp()+$5*interval '1 second'
       WHERE workspace_id=$1 AND environment_id=$2 AND session_id=$3
         AND EXISTS (
           SELECT 1 FROM mechane.managed_sessions s WHERE s.workspace_id=w.workspace_id AND s.id=w.session_id
             AND s.environment_id=w.environment_id AND s.status<>'terminated' AND s.archived_at IS NULL)
         AND NOT effects_exposed AND (lease_until IS NULL OR lease_until<=clock_timestamp())
         AND (state='queued' OR (state='starting' AND lease_until IS NOT NULL))
         AND NOT EXISTS (
           SELECT 1 FROM mechane.managed_work dirty WHERE dirty.workspace_id=w.workspace_id
             AND dirty.session_id=w.session_id AND dirty.effects_exposed
             AND (dirty.stopped_at IS NOT NULL OR dirty.lease_until<=clock_timestamp()))
         AND NOT EXISTS (
           SELECT 1 FROM mechane.managed_installed_allocations a
           WHERE a.workspace_id=w.workspace_id AND a.session_id=w.session_id AND a.released_at IS NULL)
       RETURNING id`,
      [input.workspaceId, input.environmentId, input.sessionId, secret.digest, STARTUP_TTL_SECONDS, leaseId],
    );

    const claim = result.rows[0];

    if (claim === undefined) {
      return null;
    }

    const generation = await reserveInstalledAllocation(transaction, { ...input, workId: claim.id, leaseId });

    return { workId: claim.id, workSecret: secret.secret, generation };
  });
}
