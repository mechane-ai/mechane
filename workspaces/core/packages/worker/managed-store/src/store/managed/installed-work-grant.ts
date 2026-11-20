import type { StoreContext } from '@mechane/authority-store';
import { digestWorkToken } from './work-records.ts';

type Credential = { readonly token: string; readonly sessionId: string; readonly access: 'observe' | 'tool' };

type Grant = {
  readonly workspaceId: string;
  readonly sessionId: string;
  readonly environmentId: string;
  readonly agentId: string;
  readonly workId: string;
  readonly generation: number;
};

export async function authorizeInstalledWork(context: StoreContext, credential: Credential): Promise<Grant | null> {
  const digest = digestWorkToken(credential.token);

  const result = await context.client.query<Grant>(
    `UPDATE mechane.managed_work w SET effects_exposed=w.effects_exposed OR $3='tool'
       FROM mechane.managed_installed_allocations a, mechane.managed_sessions s, mechane.workspaces space
      WHERE w.token_hash=$1 AND w.session_id=$2 AND w.installation_owned AND w.state='active'
        AND w.lease_until>clock_timestamp() AND w.environment_id='env_' || replace(w.workspace_id::text,'-','')
        AND (a.workspace_id,a.environment_id,a.session_id,a.work_id,a.lease_id)=
            (w.workspace_id,w.environment_id,w.session_id,w.id,w.lease_id)
        AND a.release_started_at IS NULL AND a.released_at IS NULL
        AND (s.workspace_id,s.environment_id,s.id)=(a.workspace_id,a.environment_id,a.session_id)
        AND s.archived_at IS NULL AND s.status<>'terminated' AND space.id=w.workspace_id
        AND ($3='observe' OR (
          NOT coalesce((space.policy->>'isSuspended')::boolean,false)
          AND coalesce((space.policy->>'hasSandboxes')::boolean,true)))
      RETURNING a.workspace_id AS "workspaceId",a.environment_id AS "environmentId",a.session_id AS "sessionId",
                a.work_id AS "workId",a.generation::float8 AS generation,s.agent_id AS "agentId"`,
    [digest, credential.sessionId, credential.access],
  );

  return result.rows[0] ?? null;
}
