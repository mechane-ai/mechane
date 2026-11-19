import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import type { CredentialKeyring } from '../../domain.ts';
import type { StoreContext } from '../context.ts';
import { StoredText } from '../row-values.ts';
import { ManagedStoreError } from './managed-record.ts';
import { BEARER_PURPOSE, credentialEndpoint } from './vault-credentials.ts';
import { decryptCredential } from './vault-envelope.ts';

const StoredBearer = Schema.Struct({
  id: StoredText,
  vault_id: StoredText,
  key_version: StoredText,
  nonce: StoredText,
  ciphertext: StoredText,
});

export type McpAuthorizationTarget = {
  readonly workspaceId: string;
  readonly agentId: string;
  readonly sessionId: string;
  readonly serverName: string;
  readonly serverUrl: string;
  readonly threadId?: string | undefined;
};

export async function resolveMcpAuthorization(
  context: StoreContext,
  keyring: CredentialKeyring,
  target: McpAuthorizationTarget,
) {
  const result = await context.client.query(
    `
    WITH session AS (
      SELECT s.agent_id,s.thread_id,s.oidc_issuer,s.oidc_subject,s.configuration
      FROM mechane.managed_sessions s JOIN mechane.workspaces w ON w.id=s.workspace_id
      WHERE s.workspace_id=$1 AND s.id=$3 AND s.archived_at IS NULL AND s.status<>'terminated'
        AND NOT coalesce((w.policy->>'isSuspended')::boolean,false)
    ), actor AS (
      SELECT configuration->'agent' AS definition FROM session WHERE agent_id=$2
      UNION ALL
      SELECT child FROM session CROSS JOIN LATERAL jsonb_array_elements(configuration#>'{agent,multiagent,agents}') child
      WHERE agent_id<>$2 AND child->>'type'='agent' AND child->>'id'=$2
    ), declared AS (
      SELECT server FROM actor CROSS JOIN LATERAL jsonb_array_elements(definition->'mcp_servers') server
      WHERE server->>'name'=$4 AND server->>'url'=$5 AND server->>'type'='url'
    )
    SELECT CASE WHEN matched.id IS NULL THEN NULL ELSE to_jsonb(matched) END AS credential,
      CASE WHEN session.thread_id=$6 AND session.agent_id=$2 AND session.oidc_subject IS NOT NULL
           THEN jsonb_build_object('issuer',session.oidc_issuer,'subject',session.oidc_subject) END AS actor,
      jsonb_strip_nulls(jsonb_build_object('name',declared.server->'name','url',declared.server->'url','type','url',
        'auth',declared.server->'auth','agent_token_header',declared.server->'agent_token_header')) AS server
    FROM declared CROSS JOIN session
    LEFT JOIN LATERAL (
      SELECT c.id,c.vault_id,c.key_version,c.nonce,c.ciphertext
      FROM jsonb_array_elements_text(session.configuration->'vault_ids') WITH ORDINALITY AS attached(id,priority)
      JOIN mechane.managed_vaults v ON v.id=attached.id AND v.workspace_id=$1 AND v.archived_at IS NULL
      JOIN mechane.managed_vault_credentials c ON c.vault_id=v.id AND c.archived_at IS NULL AND c.mcp_server_url=$7
      ORDER BY attached.priority LIMIT 1
    ) matched ON true
    WHERE NOT (declared.server ?| ARRAY['auth','agent_token_header']) OR EXISTS (
      SELECT 1 FROM mechane.managed_agents a JOIN mechane.managed_agent_versions revision
        ON revision.agent_id=a.id AND revision.version=a.version
      CROSS JOIN LATERAL jsonb_array_elements(revision.definition->'mcp_servers') live
      WHERE a.workspace_id=$1 AND a.id=$2 AND a.archived_at IS NULL AND live->>'type'='url'
        AND live->>'name'=$4 AND live->>'url'=$5 AND live->'auth' IS NOT DISTINCT FROM declared.server->'auth'
        AND live->'agent_token_header' IS NOT DISTINCT FROM declared.server->'agent_token_header'
    )
    `,
    [
      target.workspaceId,
      target.agentId,
      target.sessionId,
      target.serverName,
      target.serverUrl,
      target.threadId ?? null,
      credentialEndpoint(target.serverUrl),
    ],
  );

  if (result.rowCount === 0) {
    throw new ManagedStoreError(HttpStatusCode.NotFound, 'Session not found');
  }

  const { credential, actor, server } = Schema.decodeUnknownSync(
    Schema.Struct({
      credential: Schema.NullOr(StoredBearer),
      actor: Schema.NullOr(Schema.Struct({ issuer: StoredText, subject: StoredText })),
      server: Schema.Record(StoredText, Schema.Unknown),
    }),
  )(result.rows[0]);

  if (credential === null) {
    return { token: null, actor, server };
  }

  const reference = JSON.stringify([credential.vault_id, credential.id]);

  const token = await decryptCredential(
    { purpose: BEARER_PURPOSE, workspaceId: target.workspaceId, reference },
    keyring,
    { keyVersion: credential.key_version, nonce: credential.nonce, ciphertext: credential.ciphertext },
  );

  return { token, actor, server };
}
