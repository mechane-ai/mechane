import { MechNotFound, RequestInvalid, WorkspaceNotFound, WorkspaceOwnerRequired } from '@mechane/protocol';
import { RecordId, WorkspaceId } from '@mechane/records';
import type { StoreContext } from '../../context.ts';
import { lockWorkspace } from '../../scope-locks.ts';
import type { WorkspaceActor } from './types.ts';

type WorkspaceAuthority = { readonly role: 'owner' | 'member'; readonly personal_owner_id: string | null };
type AuthorityInput = WorkspaceActor & { readonly context: StoreContext; readonly isOwnerRequired: boolean };

export async function lockWorkspaceAuthority({
  context,
  workspaceId,
  principalId,
  isOwnerRequired,
}: AuthorityInput): Promise<WorkspaceAuthority> {
  await lockWorkspace({ client: context.client, workspaceId });

  const result = await context.client.query<WorkspaceAuthority>(
    `SELECT membership.role, workspace.personal_owner_id
     FROM mechane.workspaces workspace
     JOIN mechane.memberships membership ON membership.workspace_id = workspace.id
     WHERE workspace.id = $1 AND membership.principal_id = $2
     FOR UPDATE OF membership`,
    [workspaceId, principalId],
  );

  const authority = result.rows[0];

  if (authority === undefined) {
    throw new WorkspaceNotFound({ workspaceId: RecordId.make(workspaceId) });
  }

  if (isOwnerRequired && authority.role !== 'owner') {
    throw new WorkspaceOwnerRequired({ workspaceId: WorkspaceId.make(workspaceId) });
  }

  return authority;
}

type MechInput = { readonly context: StoreContext; readonly workspaceId: string; readonly mechId: string };

export async function requireWorkspaceMech({ context, workspaceId, mechId }: MechInput): Promise<void> {
  const result = await context.client.query('SELECT id FROM mechane.mechs WHERE workspace_id = $1 AND id = $2', [
    workspaceId,
    mechId,
  ]);

  if (result.rows.length === 0) {
    throw new MechNotFound({ mechId: RecordId.make(mechId) });
  }
}

type CredentialReferencesInput = {
  readonly context: StoreContext;
  readonly workspaceId: string;
  readonly references: ReadonlyArray<string>;
};

export async function requireCredentialReferences({
  context,
  workspaceId,
  references,
}: CredentialReferencesInput): Promise<void> {
  const result = await context.client.query<{ readonly reference: string }>(
    'SELECT reference FROM mechane.credentials WHERE workspace_id = $1 AND reference = ANY($2::text[]) FOR SHARE',
    [workspaceId, references],
  );

  const present = new Set(result.rows.map((row) => row.reference));
  const missing = references.filter((reference) => !present.has(reference));

  if (missing.length > 0) {
    throw new RequestInvalid({ reason: 'configuration references a credential that is not present in this workspace' });
  }
}
