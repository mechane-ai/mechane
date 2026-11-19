import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import type { CredentialKeyring } from '../../domain.ts';
import type { StoreContext } from '../context.ts';
import { StoredText } from '../row-values.ts';
import { ManagedStoreError } from './managed-record.ts';
import { decryptCredential } from './vault-envelope.ts';
import { GIT_PURPOSE } from './vault-resources.ts';

export type GitResourceTarget = {
  readonly workspaceId: string;
  readonly sessionId: string;
  readonly resourceId: string;
};

const StoredResource = Schema.Struct({
  url: StoredText,
  mount_path: StoredText,
  checkout: Schema.NullOr(Schema.Record(StoredText, Schema.Unknown)),
  envelope: Schema.NullOr(Schema.Struct({ key_version: StoredText, nonce: StoredText, ciphertext: StoredText })),
});

export async function gitResourceForWork(context: StoreContext, keyring: CredentialKeyring, target: GitResourceTarget) {
  const result = await context.client.query(
    `
    SELECT resource->>'url' AS url, resource->>'mount_path' AS mount_path,resource->'checkout' AS checkout,
      CASE WHEN token.resource_id IS NOT NULL THEN jsonb_build_object('key_version',token.key_version,'nonce',token.nonce,'ciphertext',token.ciphertext) END AS envelope
    FROM mechane.managed_sessions s
    CROSS JOIN LATERAL jsonb_array_elements(s.configuration->'resources') resource
    LEFT JOIN mechane.managed_session_git_tokens token ON token.workspace_id=s.workspace_id AND token.session_id=s.id AND token.resource_id=resource->>'id'
    WHERE s.workspace_id=$1 AND s.id=$2 AND s.archived_at IS NULL AND s.status<>'terminated' AND resource->>'id'=$3 AND resource->>'type'='github_repository'`,
    [target.workspaceId, target.sessionId, target.resourceId],
  );

  if (result.rowCount === 0) {
    throw new ManagedStoreError(HttpStatusCode.NotFound, 'Session repository not found');
  }

  const row = Schema.decodeUnknownSync(StoredResource)(result.rows[0]);
  const resource = { url: row.url, mountPath: row.mount_path, checkout: row.checkout };

  if (row.envelope === null) {
    return { ...resource, token: null };
  }

  const reference = JSON.stringify([target.sessionId, target.resourceId, row.url]);

  const token = await decryptCredential({ purpose: GIT_PURPOSE, workspaceId: target.workspaceId, reference }, keyring, {
    keyVersion: row.envelope.key_version,
    nonce: row.envelope.nonce,
    ciphertext: row.envelope.ciphertext,
  });

  return { ...resource, token };
}
