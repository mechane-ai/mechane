import type { StoreContext } from '../../context.ts';
import type { WorkspaceActor } from './types.ts';

type ConfigurationAudit = WorkspaceActor & {
  readonly context: StoreContext;
  readonly action: string;
  readonly targetId: string;
};

export async function recordConfigurationAudit({
  context,
  workspaceId,
  principalId,
  credentialId,
  action,
  targetId,
}: ConfigurationAudit): Promise<void> {
  await context.client.query(
    'INSERT INTO mechane.audit_events(id,workspace_id,principal_id,credential_id,action,target_id) VALUES($1,$2,$3,$4,$5,$6)',
    [crypto.randomUUID(), workspaceId, principalId, credentialId ?? null, action, targetId],
  );
}
