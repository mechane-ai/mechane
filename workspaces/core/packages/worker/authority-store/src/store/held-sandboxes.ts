import { Schema } from 'effect';
import type { StoreContext } from './context.ts';

const HeldMachines = Schema.Struct({ held_machines: Schema.Number, workspace_machines: Schema.Number });

export async function countHeldSandboxes(context: StoreContext, workspaceId: string) {
  const counted = await context.client.query(
    `WITH held AS (SELECT workspace_id FROM mechane.sandbox_capacity WHERE state='held'
  UNION ALL SELECT workspace_id FROM mechane.managed_installed_allocations WHERE released_at IS NULL)
     SELECT count(*) AS held_machines, count(*) FILTER (WHERE workspace_id=$1) AS workspace_machines FROM held`,
    [workspaceId],
  );

  return Schema.decodeUnknownSync(HeldMachines)(counted.rows[0]);
}
