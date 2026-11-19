import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import type { StoreContext } from '../context.ts';
import { StoredText } from '../row-values.ts';
import { ManagedStoreError } from './managed-record.ts';

type Scope = {
  readonly workspaceId: string;
  readonly id: string;
  readonly runtimeMechId: string;
  readonly forwardMetadata: ReadonlyArray<string>;
};

const Creator = Schema.Struct({ issuer: StoredText, subject: StoredText });

const Session = Schema.Struct({
  id: StoredText,
  agent_id: StoredText,
  environment_id: StoredText,
  metadata: Schema.Record(StoredText, StoredText),
});

export async function sessionAssertionContext(context: StoreContext, scope: Scope) {
  const result = await context.client.query(
    `SELECT jsonb_build_object(
       'id', s.id, 'agent_id', s.agent_id, 'environment_id', s.environment_id,
       'metadata', COALESCE((SELECT jsonb_object_agg(e.key,e.value)
          FROM jsonb_each(s.configuration->'metadata') e WHERE e.key=ANY($4::text[])), '{}'::jsonb)
     ) AS session, jsonb_build_object(
       'issuer', COALESCE(oidc.issuer_url, CASE WHEN install.principal_id IS NOT NULL THEN 'cma' ELSE 'mechane' END),
       'subject', COALESCE(oidc.subject_value, CASE WHEN install.principal_id IS NOT NULL THEN 'server' ELSE s.creator_id::text END)
     ) AS principal
     FROM mechane.managed_sessions s
     LEFT JOIN mechane.managed_oidc_identities oidc ON oidc.workspace_id=s.workspace_id AND oidc.principal_id=s.creator_id
     LEFT JOIN mechane.managed_installations install ON install.workspace_id=s.workspace_id AND install.principal_id=s.creator_id
     WHERE s.workspace_id=$1 AND s.id=$2 AND s.archived_at IS NULL AND s.status<>'terminated'
       AND (s.runtime_mech_id=$3::uuid OR EXISTS (
          SELECT 1 FROM jsonb_each_text(s.child_runtime_mech_ids) child WHERE child.value=$3::uuid::text))`,
    [scope.workspaceId, scope.id, scope.runtimeMechId, scope.forwardMetadata],
  );

  if (result.rows.length !== 1) {
    throw new ManagedStoreError(HttpStatusCode.NotFound, 'Model assertion session was not found');
  }

  const { session, principal } = Schema.decodeUnknownSync(Schema.Struct({ session: Session, principal: Creator }))(
    result.rows[0],
  );

  if (scope.forwardMetadata.length === 0) {
    const { id, agent_id, environment_id } = session;

    return { principal, session: { id, agent_id, environment_id } };
  }

  return { principal, session };
}
