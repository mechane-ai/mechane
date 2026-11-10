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

export async function recordConfigurationChange({
  context,
  workspaceId,
  principalId,
  credentialId,
  action,
  targetId,
  recipients,
}: ConfigurationChange): Promise<void> {
  await context.client.query(
    'INSERT INTO mechane.audit_events(id,workspace_id,principal_id,credential_id,action,target_id) VALUES($1,$2,$3,$4,$5,$6)',
    [crypto.randomUUID(), workspaceId, principalId, credentialId ?? null, action, targetId],
  );
  await queueControlChanges({ context, workspaceId, ...recipients });
}
