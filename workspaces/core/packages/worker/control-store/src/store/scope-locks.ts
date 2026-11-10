import type { StoreClient } from './context.ts';

type WorkspaceLock = { readonly client: StoreClient; readonly workspaceId: string };

export async function lockWorkspace({ client, workspaceId }: WorkspaceLock): Promise<void> {
  await client.query('SELECT id FROM mechane.workspaces WHERE id=$1 FOR UPDATE', [workspaceId]);
}
