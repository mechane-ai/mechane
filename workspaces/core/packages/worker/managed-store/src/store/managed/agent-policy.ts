import { lockWorkspaceAuthority, recordConfigurationAudit } from '@mechane/authority-store';
import type { StoreContext, WorkspaceActor } from '@mechane/authority-store';
import { RequestInvalid } from '@mechane/protocol';

type Target = WorkspaceActor & { readonly agentId: string };

type PolicyRow = {
  readonly creator_id: string;
  readonly daily_cap_micros: number;
  readonly archived_at: string | null;
};

async function readPolicy(context: StoreContext, target: Target) {
  await lockWorkspaceAuthority({ context, ...target, isOwnerRequired: true });

  const found = await context.client.query<PolicyRow>(
    `SELECT creator_id,archived_at,daily_cap_micros
     FROM mechane.managed_agents
     WHERE workspace_id=$1 AND id=$2
     FOR UPDATE`,
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

        await transaction.client.query(
          'UPDATE mechane.managed_agents SET daily_cap_micros=$3 WHERE workspace_id=$1 AND id=$2',
          [input.workspaceId, input.agentId, input.dailyCapMicros],
        );

        await recordConfigurationAudit({
          context: transaction,
          ...input,
          action: 'managed-agent.daily-cap-set',
          targetId: input.agentId,
        });

        return { ...policy, dailyCapMicros: input.dailyCapMicros };
      }),
  };
}
