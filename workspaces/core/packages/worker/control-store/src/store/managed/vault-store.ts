import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import type { CredentialKeyring } from '../../domain.ts';
import type { StoreContext } from '../context.ts';
import { decodePage, managedId, ManagedStoreError, pageSize } from './managed-record.ts';
import type { ManagedDocument, ManagedPageQuery, ManagedScope } from './types.ts';
import { createVaultCredentials } from './vault-credentials.ts';
import {
  checkedMetadata,
  checkedName,
  lockActiveVault,
  optionalName,
  pageRows,
  patchMetadata,
  requireVault,
  VaultSchema,
} from './vault-fields.ts';
import { gitResourceForWork } from './vault-git.ts';
import type { GitResourceTarget } from './vault-git.ts';
import type { McpAuthorizationTarget } from './vault-resolve.ts';
import { resolveMcpAuthorization } from './vault-resolve.ts';
import type { GitRotation } from './vault-resources.ts';
import { rotateGitResourceCredential } from './vault-resources.ts';

export function createManagedVaultStore(context: StoreContext, keyring: CredentialKeyring) {
  async function create(scope: ManagedScope, body: ManagedDocument) {
    const name = checkedName(body['display_name']);
    const metadata = checkedMetadata(body['metadata']);
    const id = managedId('vlt');

    const result = await context.client.query(
      `INSERT INTO mechane.managed_vaults(id,workspace_id,creator_id,display_name,metadata)
      VALUES($1,$2,$3,$4,$5) RETURNING id,'vault' AS type,display_name,metadata,created_at,updated_at,archived_at`,
      [id, scope.workspaceId, scope.principalId, name, metadata],
    );

    return Schema.decodeUnknownSync(VaultSchema)(result.rows[0]);
  }

  async function get(scope: ManagedScope, id: string) {
    return await requireVault(context, { scope, vaultId: id });
  }

  async function list(scope: ManagedScope, query: ManagedPageQuery) {
    const limit = pageSize(query);
    const cursor = decodePage(query.page);

    const result = await context.client.query(
      `SELECT id,'vault' AS type,display_name,metadata,created_at,updated_at,archived_at FROM mechane.managed_vaults WHERE workspace_id=$1 AND (creator_id=$2 OR $3)
      AND ($4 OR archived_at IS NULL) AND ($5::timestamptz IS NULL OR (created_at,id)<($5,$6))
      ORDER BY created_at DESC,id DESC LIMIT $7`,
      [
        scope.workspaceId,
        scope.principalId,
        scope.isAdmin,
        query.includeArchived ?? false,
        cursor?.createdAt ?? null,
        cursor?.id ?? null,
        limit + 1,
      ],
    );

    return pageRows(Schema.decodeUnknownSync(Schema.Array(VaultSchema))(result.rows), limit);
  }

  async function update(scope: ManagedScope, id: string, body: ManagedDocument) {
    return await context.atomic(async (transaction) => {
      const current = await lockActiveVault(transaction, scope, id);
      const name = optionalName(body['display_name']) ?? current.display_name;
      const metadata = patchMetadata(current.metadata, body['metadata']);

      const result = await transaction.client.query(
        `UPDATE mechane.managed_vaults SET display_name=$2,metadata=$3,updated_at=clock_timestamp() WHERE id=$1 RETURNING id,'vault' AS type,display_name,metadata,created_at,updated_at,archived_at`,
        [id, name, metadata],
      );

      return Schema.decodeUnknownSync(VaultSchema)(result.rows[0]);
    });
  }

  async function archive(scope: ManagedScope, id: string) {
    return await context.atomic(async (transaction) => {
      const current = await requireVault(transaction, { scope, vaultId: id, lockClause: 'FOR UPDATE' });

      if (current.archived_at !== null) {
        return current;
      }

      await transaction.client.query(
        'UPDATE mechane.managed_vault_credentials SET archived_at=now(),updated_at=now() WHERE vault_id=$1 AND archived_at IS NULL',
        [id],
      );

      const result = await transaction.client.query(
        `UPDATE mechane.managed_vaults SET archived_at=now(),updated_at=now() WHERE id=$1 RETURNING id,'vault' AS type,display_name,metadata,created_at,updated_at,archived_at`,
        [id],
      );

      return Schema.decodeUnknownSync(VaultSchema)(result.rows[0]);
    });
  }

  async function remove(scope: ManagedScope, id: string) {
    const result = await context.client.query(
      'DELETE FROM mechane.managed_vaults WHERE workspace_id=$1 AND (creator_id=$2 OR $3) AND id=$4',
      [scope.workspaceId, scope.principalId, scope.isAdmin, id],
    );

    if (result.rowCount === 0) {
      throw new ManagedStoreError(HttpStatusCode.NotFound, 'Vault not found');
    }

    return { id, type: 'vault_deleted' };
  }

  return {
    create,
    get,
    list,
    update,
    archive,
    delete: remove,
    credentials: createVaultCredentials(context, keyring),
    resolveMcpAuthorization: async (target: McpAuthorizationTarget) =>
      await resolveMcpAuthorization(context, keyring, target),
    gitResourceForWork: async (target: GitResourceTarget) => await gitResourceForWork(context, keyring, target),
    rotateGitResourceToken: async (target: GitRotation) => await rotateGitResourceCredential(context, keyring, target),
  };
}
