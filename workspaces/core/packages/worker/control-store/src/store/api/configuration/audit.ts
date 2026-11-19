import type { StoreContext } from '../../context.ts';
import { queueControlChanges } from '../../control-changes.ts';
import type { ControlChangeRecipients } from '../../control-changes.ts';
import type { WorkspaceActor } from './types.ts';

type ConfigurationChange = WorkspaceActor & {
  readonly context: StoreContext;
  readonly action: string;
  readonly targetId: string;
  readonly recipients?: ControlChangeRecipients;
};

export async function recordConfigurationAudit({
  context,
  workspaceId,
  principalId,
  credentialId,
  action,
  targetId,
}: Omit<ConfigurationChange, 'recipients'>): Promise<void> {
  await context.client.query(
    'INSERT INTO mechane.audit_events(id,workspace_id,principal_id,credential_id,action,target_id) VALUES($1,$2,$3,$4,$5,$6)',
    [crypto.randomUUID(), workspaceId, principalId, credentialId ?? null, action, targetId],
  );
}

export async function recordConfigurationChange(change: ConfigurationChange): Promise<void> {
  await recordConfigurationAudit(change);
  await queueControlChanges({ context: change.context, workspaceId: change.workspaceId, ...change.recipients });
}
