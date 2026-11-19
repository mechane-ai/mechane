import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { createHash, randomBytes } from 'node:crypto';
import type { StoreContext } from '../context.ts';
import { StoredTimestamp } from '../row-values.ts';
import { isInstalledEnvironment } from './installed-session.ts';
import { managedId, ManagedStoreError } from './managed-record.ts';
import type { ManagedScope } from './types.ts';

type EnvironmentKeyRequest = { readonly scope: ManagedScope; readonly id: string };
type EnvironmentKeyRevocation = EnvironmentKeyRequest & { readonly keyId: string };
type EnvironmentCredential = { readonly environmentId: string; readonly token: string };
const ResolvedKey = Schema.Struct({ workspaceId: Schema.String, environmentId: Schema.String, keyId: Schema.String });
const KeyExpiry = Schema.Struct({ expires_at: StoredTimestamp });
const SECRET_RANDOM_BYTES = 32;
const SecretPrefix = 'mche_env_';

function digest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function requireEnvironmentAdmin(scope: ManagedScope): void {
  if (!scope.isAdmin) {
    throw new ManagedStoreError(HttpStatusCode.Forbidden, 'Managing an environment requires an administrator.');
  }
}

export function createEnvironmentKeyStore(context: StoreContext) {
  return {
    async issueKey({ scope, id }: EnvironmentKeyRequest) {
      requireEnvironmentAdmin(scope);

      if (isInstalledEnvironment({ workspaceId: scope.workspaceId, environmentId: id })) {
        throw new ManagedStoreError(HttpStatusCode.Conflict, 'The installation manages workers for this environment.');
      }

      const keyId = managedId('etok');
      const secret = SecretPrefix + randomBytes(SECRET_RANDOM_BYTES).toString('base64url');
      const tokenDigest = digest(secret);

      const result = await context.client.query(
        `INSERT INTO mechane.managed_environment_keys (id,workspace_id,environment_id,token_digest)
         SELECT $3, workspace_id, id, $4 FROM mechane.managed_environments
         WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL FOR SHARE RETURNING expires_at`,
        [scope.workspaceId, id, keyId, tokenDigest],
      );

      if (result.rowCount !== 1) {
        throw new ManagedStoreError(HttpStatusCode.NotFound, 'Active environment not found.');
      }

      const expiry = Schema.decodeUnknownSync(KeyExpiry, { onExcessProperty: 'error' })(result.rows[0]);

      return { id: keyId, key: secret, expires_at: expiry.expires_at };
    },

    async revokeKey({ scope, id, keyId }: EnvironmentKeyRevocation) {
      requireEnvironmentAdmin(scope);

      const result = await context.client.query(
        `UPDATE mechane.managed_environment_keys SET revoked_at=COALESCE(revoked_at, now())
         WHERE workspace_id=$1 AND environment_id=$2 AND id=$3`,
        [scope.workspaceId, id, keyId],
      );

      if (result.rowCount !== 1) {
        throw new ManagedStoreError(HttpStatusCode.NotFound, 'Environment key not found.');
      }

      return { id: keyId, type: 'environment_key_revoked' };
    },

    async resolveKey({ environmentId, token }: EnvironmentCredential) {
      if (!token.startsWith(SecretPrefix)) {
        return null;
      }

      const tokenDigest = digest(token);

      const result = await context.client.query(
        `SELECT workspace_id AS "workspaceId", environment_id AS "environmentId", id AS "keyId"
         FROM mechane.managed_environment_keys
         WHERE environment_id=$1 AND token_digest=$2 AND revoked_at IS NULL AND expires_at > now()`,
        [environmentId, tokenDigest],
      );

      if (result.rows[0] === undefined) {
        return null;
      }

      return Schema.decodeUnknownSync(ResolvedKey, { onExcessProperty: 'error' })(result.rows[0]);
    },
  };
}
