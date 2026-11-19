import { HttpStatusCode } from '@mechane/records';
import { Record, Schema } from 'effect';
import type { StoreContext } from '../context.ts';
import { StoredText, StoredTimestamp } from '../row-values.ts';
import { encodePage, ManagedStoreError } from './managed-record.ts';
import type { ManagedDocument, ManagedScope } from './types.ts';

const DISPLAY_NAME_MAX_CHARS = 255;
const VaultName = Schema.NonEmptyString.check(Schema.isMaxLength(DISPLAY_NAME_MAX_CHARS));
const METADATA_MAX_PAIRS = 16;
const METADATA_KEY_MAX_CHARS = 64;
const METADATA_VALUE_MAX_CHARS = 512;

export const VaultSchema = Schema.Struct({
  id: StoredText,
  type: Schema.Literal('vault'),
  display_name: StoredText,
  metadata: Schema.Record(StoredText, StoredText),
  created_at: StoredTimestamp,
  updated_at: StoredTimestamp,
  archived_at: Schema.NullOr(StoredTimestamp),
});

export const CredentialSchema = Schema.Struct({
  ...VaultSchema.fields,
  type: Schema.Literal('vault_credential'),
  display_name: Schema.NullOr(StoredText),
  vault_id: StoredText,
  auth: Schema.Struct({ type: Schema.Literal('static_bearer'), mcp_server_url: StoredText }),
});

export function checkedName(value: unknown): string {
  if (!Schema.is(VaultName)(value) || value.includes('\0')) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid display_name');
  }

  return value;
}

export function optionalName(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return checkedName(value);
}

export function checkedMetadata(value: unknown): Readonly<Record<string, string>> {
  if (value === null || value === undefined) {
    return {};
  }

  if (!Schema.is(Schema.Record(StoredText, Schema.Unknown))(value)) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid metadata');
  }

  const entries = Record.toEntries(value);

  if (entries.length > METADATA_MAX_PAIRS) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Too many metadata pairs');
  }

  const validated: Array<readonly [string, string]> = [];

  for (const [key, item] of entries) {
    if (key.length === 0 || key.length > METADATA_KEY_MAX_CHARS || key.includes('\0')) {
      throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid metadata key');
    }

    if (typeof item !== 'string' || item.length > METADATA_VALUE_MAX_CHARS || item.includes('\0')) {
      throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid metadata value');
    }

    validated.push([key, item]);
  }

  return Record.fromEntries(validated);
}

export function patchMetadata(stored: Readonly<Record<string, string>>, patch: unknown) {
  if (patch === null || patch === undefined) {
    return stored;
  }

  if (!Schema.is(Schema.Record(StoredText, Schema.Unknown))(patch)) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid metadata patch');
  }

  const pairs = new Map<string, unknown>(Record.toEntries(stored));

  for (const [key, item] of Record.toEntries(patch)) {
    if (item === null) {
      pairs.delete(key);
    } else {
      pairs.set(key, item);
    }
  }

  return checkedMetadata(Record.fromEntries(pairs));
}

export function pageRows<Row extends ManagedDocument & { readonly id: string; readonly created_at: string }>(
  rows: ReadonlyArray<Row>,
  maxRows: number,
) {
  if (rows.length <= maxRows) {
    return { data: rows, next_page: null };
  }

  const last = rows[maxRows - 1];

  if (last === undefined) {
    throw new Error('Missing page boundary');
  }

  return { data: rows.slice(0, maxRows), next_page: encodePage({ createdAt: last.created_at, id: last.id }) };
}

type VaultLookup = {
  readonly scope: ManagedScope;
  readonly vaultId: string;
  readonly lockClause?: '' | 'FOR UPDATE' | 'FOR SHARE';
};

export async function requireVault(context: StoreContext, { scope, vaultId, lockClause = '' }: VaultLookup) {
  const values = [scope.workspaceId, scope.principalId, scope.isAdmin, vaultId];

  if (lockClause === 'FOR UPDATE') {
    await context.client.query(
      'SELECT id FROM mechane.managed_vaults WHERE workspace_id=$1 AND (creator_id=$2 OR $3) AND id=$4 FOR UPDATE',
      values,
    );
  } else if (lockClause === 'FOR SHARE') {
    await context.client.query(
      'SELECT id FROM mechane.managed_vaults WHERE workspace_id=$1 AND (creator_id=$2 OR $3) AND id=$4 FOR SHARE',
      values,
    );
  }

  const result = await context.client.query(
    `SELECT id,'vault' AS type,display_name,metadata,created_at,updated_at,archived_at FROM mechane.managed_vaults
     WHERE workspace_id=$1 AND (creator_id=$2 OR $3) AND id=$4`,
    values,
  );

  if (result.rowCount === 0) {
    throw new ManagedStoreError(HttpStatusCode.NotFound, 'Vault not found');
  }

  return Schema.decodeUnknownSync(VaultSchema)(result.rows[0]);
}

export async function lockActiveVault(context: StoreContext, scope: ManagedScope, vaultId: string) {
  const vault = await requireVault(context, { scope, vaultId, lockClause: 'FOR UPDATE' });

  if (vault.archived_at !== null) {
    throw new ManagedStoreError(HttpStatusCode.Conflict, 'Vault is archived');
  }

  return vault;
}

export function checkedAuth(value: unknown): ManagedDocument {
  if (!Schema.is(Schema.Record(StoredText, Schema.Unknown))(value)) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid credential auth');
  }

  if (value['type'] !== 'static_bearer') {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Only static_bearer is enabled for this installation');
  }

  return value;
}
