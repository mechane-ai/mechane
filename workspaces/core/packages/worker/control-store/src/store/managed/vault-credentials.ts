import { HttpStatusCode } from '@mechane/records';
import { Redacted, Schema } from 'effect';
import type { CredentialKeyring } from '../../domain.ts';
import type { StoreContext } from '../context.ts';
import { decodePage, managedId, ManagedStoreError, pageSize } from './managed-record.ts';
import type { ManagedDocument, ManagedPageQuery, ManagedScope } from './types.ts';
import { encryptCredential } from './vault-envelope.ts';
import {
  checkedAuth,
  checkedMetadata,
  CredentialSchema,
  lockActiveVault,
  optionalName,
  pageRows,
  patchMetadata,
  requireVault,
} from './vault-fields.ts';

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);
const MCP_URL_MAX_CHARS = 2048;
const MCP_ENDPOINT = /^https?:\/\/[^/?#@\\\s]+(?<path>\/[^?#\\\s]*)?(?<query>\?[^#\s]*)?$/iu;
const VAULT_MAX_CREDENTIALS = 20;
export const BEARER_PURPOSE = 'mechane.managed-vault.mcp-bearer.v1';

export function credentialEndpoint(value: unknown): string {
  if (typeof value !== 'string' || value.length > MCP_URL_MAX_CHARS || !URL.canParse(value)) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid mcp_server_url');
  }

  const url = new URL(value);

  const urlParts = MCP_ENDPOINT.exec(value)?.groups;

  if (urlParts === undefined) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid mcp_server_url');
  }

  const isLoopback = LOOPBACK_HOSTS.has(url.hostname);

  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback)) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid mcp_server_url');
  }

  const path = (urlParts['path'] ?? '').replace(/\/+$/u, '');

  return url.origin + path + (urlParts['query'] ?? '');
}

function checkedToken(value: unknown): Redacted.Redacted {
  if (typeof value !== 'string' || value.length === 0 || /[\r\n]/.test(value)) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid bearer token');
  }

  return Redacted.make(value);
}

async function getCredential(context: StoreContext, vaultId: string, credentialId: string) {
  const result = await context.client.query(
    `SELECT id,'vault_credential' AS type,vault_id,display_name,metadata,created_at,updated_at,archived_at,
  jsonb_build_object('type','static_bearer','mcp_server_url',mcp_server_url) AS auth FROM mechane.managed_vault_credentials WHERE vault_id=$1 AND id=$2`,
    [vaultId, credentialId],
  );

  if (result.rowCount === 0) {
    throw new ManagedStoreError(HttpStatusCode.NotFound, 'Credential not found');
  }

  return Schema.decodeUnknownSync(CredentialSchema)(result.rows[0]);
}

type CredentialUpdate = {
  readonly scope: ManagedScope;
  readonly vaultId: string;
  readonly id: string;
  readonly body: ManagedDocument;
};

type TokenRotation = {
  readonly keyring: CredentialKeyring;
  readonly scope: ManagedScope;
  readonly id: string;
  readonly vaultId: string;
  readonly token: unknown;
};

async function rotateToken({ keyring, scope, id, vaultId, token }: TokenRotation) {
  if (token === undefined || token === null) {
    return null;
  }

  return await encryptCredential(
    { purpose: BEARER_PURPOSE, workspaceId: scope.workspaceId, reference: JSON.stringify([vaultId, id]) },
    keyring,
    checkedToken(token),
  );
}

export function createVaultCredentials(context: StoreContext, keyring: CredentialKeyring) {
  async function create(scope: ManagedScope, vaultId: string, body: ManagedDocument) {
    const auth = checkedAuth(body['auth']);
    const url = credentialEndpoint(auth['mcp_server_url']);
    const token = checkedToken(auth['token']);
    const metadata = checkedMetadata(body['metadata']);
    const name = optionalName(body['display_name']);

    return await context.atomic(async (transaction) => {
      await lockActiveVault(transaction, scope, vaultId);

      const count = await transaction.client.query(
        'SELECT COUNT(*)::integer AS count FROM mechane.managed_vault_credentials WHERE vault_id=$1 AND archived_at IS NULL',
        [vaultId],
      );

      if (
        Schema.decodeUnknownSync(Schema.Struct({ count: Schema.Number }))(count.rows[0]).count >= VAULT_MAX_CREDENTIALS
      ) {
        throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Vault credential limit reached');
      }

      const id = managedId('vcrd');

      const envelope = await encryptCredential(
        { purpose: BEARER_PURPOSE, workspaceId: scope.workspaceId, reference: JSON.stringify([vaultId, id]) },
        keyring,
        token,
      );

      const result = await transaction.client.query(
        `INSERT INTO mechane.managed_vault_credentials
        (id,workspace_id,vault_id,display_name,metadata,mcp_server_url,key_version,nonce,ciphertext)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(vault_id,mcp_server_url) WHERE archived_at IS NULL DO NOTHING RETURNING id,'vault_credential' AS type,vault_id,display_name,metadata,created_at,updated_at,archived_at,
  jsonb_build_object('type','static_bearer','mcp_server_url',mcp_server_url) AS auth`,
        [id, scope.workspaceId, vaultId, name, metadata, url, envelope.keyVersion, envelope.nonce, envelope.ciphertext],
      );

      if (result.rowCount === 0) {
        throw new ManagedStoreError(HttpStatusCode.Conflict, 'An active credential already uses this MCP server URL');
      }

      return Schema.decodeUnknownSync(CredentialSchema)(result.rows[0]);
    });
  }

  async function get(scope: ManagedScope, vaultId: string, id: string) {
    await requireVault(context, { scope, vaultId });

    return await getCredential(context, vaultId, id);
  }

  async function list(scope: ManagedScope, vaultId: string, query: ManagedPageQuery) {
    await requireVault(context, { scope, vaultId });

    const limit = pageSize(query);
    const cursor = decodePage(query.page);

    const result = await context.client.query(
      `SELECT id,'vault_credential' AS type,vault_id,display_name,metadata,created_at,updated_at,archived_at,
  jsonb_build_object('type','static_bearer','mcp_server_url',mcp_server_url) AS auth FROM mechane.managed_vault_credentials WHERE vault_id=$1
      AND ($2 OR archived_at IS NULL) AND ($3::timestamptz IS NULL OR (created_at,id)<($3,$4))
      ORDER BY created_at DESC,id DESC LIMIT $5`,
      [vaultId, query.includeArchived ?? false, cursor?.createdAt ?? null, cursor?.id ?? null, limit + 1],
    );

    return pageRows(Schema.decodeUnknownSync(Schema.Array(CredentialSchema))(result.rows), limit);
  }

  async function update({ scope, vaultId, id, body }: CredentialUpdate) {
    return await context.atomic(async (transaction) => {
      await lockActiveVault(transaction, scope, vaultId);

      const current = await getCredential(transaction, vaultId, id);

      if (current.archived_at !== null) {
        throw new ManagedStoreError(HttpStatusCode.Conflict, 'Credential is archived');
      }

      const auth = checkedAuth(body['auth'] ?? { type: 'static_bearer' });

      if (Object.hasOwn(auth, 'mcp_server_url')) {
        throw new ManagedStoreError(HttpStatusCode.BadRequest, 'mcp_server_url is immutable');
      }

      const name = optionalName(body['display_name']) ?? current.display_name;
      const metadata = patchMetadata(current.metadata, body['metadata']);
      const token = auth['token'];
      const envelope = await rotateToken({ keyring, scope, id, vaultId, token });

      const result = await transaction.client.query(
        `UPDATE mechane.managed_vault_credentials SET display_name=$3,metadata=$4,
        key_version=coalesce($5,key_version),nonce=coalesce($6,nonce),ciphertext=coalesce($7,ciphertext),updated_at=clock_timestamp()
        WHERE vault_id=$1 AND id=$2 RETURNING id,'vault_credential' AS type,vault_id,display_name,metadata,created_at,updated_at,archived_at,
  jsonb_build_object('type','static_bearer','mcp_server_url',mcp_server_url) AS auth`,
        [
          vaultId,
          id,
          name,
          metadata,
          envelope?.keyVersion ?? null,
          envelope?.nonce ?? null,
          envelope?.ciphertext ?? null,
        ],
      );

      return Schema.decodeUnknownSync(CredentialSchema)(result.rows[0]);
    });
  }

  async function changeStoredCredential<Result>(
    scope: ManagedScope,
    vaultId: string,
    change: (transaction: StoreContext) => Promise<Result>,
  ): Promise<Result> {
    return await context.atomic(async (transaction) => {
      await requireVault(transaction, { scope, vaultId, lockClause: 'FOR UPDATE' });

      return await change(transaction);
    });
  }

  async function archive(scope: ManagedScope, vaultId: string, id: string) {
    return await changeStoredCredential(scope, vaultId, async (transaction) => {
      const result = await transaction.client.query(
        `UPDATE mechane.managed_vault_credentials
       SET archived_at=coalesce(archived_at,now()),updated_at=coalesce(archived_at,now()) WHERE vault_id=$1 AND id=$2 RETURNING id,'vault_credential' AS type,vault_id,display_name,metadata,created_at,updated_at,archived_at,
  jsonb_build_object('type','static_bearer','mcp_server_url',mcp_server_url) AS auth`,
        [vaultId, id],
      );

      if (result.rowCount === 0) {
        throw new ManagedStoreError(HttpStatusCode.NotFound, 'Credential not found');
      }

      return Schema.decodeUnknownSync(CredentialSchema)(result.rows[0]);
    });
  }

  async function remove(scope: ManagedScope, vaultId: string, id: string) {
    return await changeStoredCredential(scope, vaultId, async (transaction) => {
      const result = await transaction.client.query(
        'DELETE FROM mechane.managed_vault_credentials WHERE vault_id=$1 AND id=$2',
        [vaultId, id],
      );

      if (result.rowCount === 0) {
        throw new ManagedStoreError(HttpStatusCode.NotFound, 'Credential not found');
      }

      return { id, type: 'vault_credential_deleted' };
    });
  }

  async function validateOAuth(scope: ManagedScope, vaultId: string, id: string): Promise<never> {
    await get(scope, vaultId, id);

    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'MCP OAuth is unavailable on this server');
  }

  return { create, get, list, update, archive, delete: remove, validateOAuth };
}
