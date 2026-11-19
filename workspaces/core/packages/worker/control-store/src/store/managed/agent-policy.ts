import { RequestInvalid } from '@mechane/protocol';
import { recordConfigurationAudit } from '../api/configuration/audit.ts';
import { lockWorkspaceAuthority } from '../api/configuration/authority.ts';
import type { WorkspaceActor } from '../api/configuration/types.ts';
import { createMechStore } from '../api/mechs/mechs.ts';
import type { StoreContext } from '../context.ts';

type Target = WorkspaceActor & { readonly agentId: string };

type PolicyRow = {
  readonly creator_id: string;
  readonly runtime_id: string;
  readonly daily_cap_micros: number;
  readonly revision: number;
  readonly archived_at: string | null;
};

async function readPolicy(context: StoreContext, target: Target) {
  await lockWorkspaceAuthority({ context, ...target, isOwnerRequired: true });

  const found = await context.client.query<PolicyRow>(
    `SELECT a.creator_id,a.runtime_id,a.archived_at,m.daily_cap_micros,m.revision
     FROM mechane.managed_agents a JOIN mechane.mechs m ON (m.workspace_id,m.id)=(a.workspace_id,a.runtime_id)
     WHERE a.workspace_id=$1 AND a.id=$2`,
    [target.workspaceId, target.agentId],
  );

  const row = found.rows[0];

  if (row === undefined) {
    throw new RequestInvalid({ reason: 'Managed agent does not exist in this workspace' });
  }

  return row;
}

function policyRecord(agentId: string, row: PolicyRow) {
  return { agentId, creatorPrincipalId: row.creator_id, dailyCapMicros: row.daily_cap_micros };
}

export function createManagedAgentPolicyStore(context: StoreContext) {
  return {
    show: (target: Target) =>
      context.atomic(async (transaction) => {
        const row = await readPolicy(transaction, target);

        return policyRecord(target.agentId, row);
      }),
    setDailyCap: (input: Target & { readonly dailyCapMicros: number }) =>
      context.atomic(async (transaction) => {
        const row = await readPolicy(transaction, input);

        if (row.archived_at !== null) {
          throw new RequestInvalid({ reason: 'Archived agents cannot change spending policy' });
        }

        const policy = policyRecord(input.agentId, row);

        if (policy.dailyCapMicros === input.dailyCapMicros) {
          return policy;
        }

        const mech = await createMechStore(transaction).updateMech({
          workspaceId: input.workspaceId,
          principalId: input.principalId,
          mechId: row.runtime_id,
          expectedRevision: row.revision,
          changes: { dailyCapMicros: input.dailyCapMicros },
        });

        await recordConfigurationAudit({
          context: transaction,
          ...input,
          action: 'managed-agent.daily-cap-set',
          targetId: input.agentId,
        });

        return { ...policy, dailyCapMicros: mech.dailyCapMicros };
      }),
  };
}
