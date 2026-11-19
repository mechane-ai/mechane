import { HttpStatusCode } from '@mechane/records';
import type { StoreContext } from '../context.ts';
import { ManagedStoreError } from './managed-record.ts';
import { digestWorkToken } from './work-records.ts';

type SessionCredential = { readonly workspaceId: string; readonly sessionId: string; readonly token: string };

export async function lockManagedResourceWork(context: StoreContext, credential: SessionCredential): Promise<void> {
  const digest = digestWorkToken(credential.token);

  const rows = await context.client.query(
    `SELECT id FROM mechane.managed_work w WHERE workspace_id=$1 AND session_id=$2 AND token_hash=$3
     AND state IN ('starting','active','stopping') AND lease_until>clock_timestamp() AND mechane.workspace_allows_worker_effect(w.workspace_id,w.installation_owned) FOR SHARE OF w`,
    [credential.workspaceId, credential.sessionId, digest],
  );

  if (rows.rowCount !== 1) {
    throw new ManagedStoreError(HttpStatusCode.Forbidden, 'Work credential no longer authorizes this session');
  }
}
