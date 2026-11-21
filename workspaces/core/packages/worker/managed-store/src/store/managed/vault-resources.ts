import { encryptCredential, managedId, ManagedStoreError, StoredText } from '@mechane/authority-store';
import type { CredentialKeyring, ManagedDocument, ManagedScope, StoreContext } from '@mechane/authority-store';
import { HttpStatusCode } from '@mechane/records';
import { Redacted, Schema } from 'effect';
import { posix } from 'node:path';
import { canonicalMountKey, resolveFileMount } from './files.ts';
import { resolveMemoryMount } from './memory-stores.ts';
import { requireVault } from './vault-fields.ts';

const ResourceDocument = Schema.Record(StoredText, Schema.Unknown);
const MEMORY_MAX_MOUNTS = 8;
const BRANCH_NAME_MAX_CHARS = 255;
const REPOSITORY_URL_MAX_CHARS = 2048;
const MOUNT_PATH_MAX_CHARS = 4096;
const GIT_TOKEN_MAX_CHARS = 4096;
const GitAuthorizationToken = Schema.NonEmptyString.check(Schema.isMaxLength(GIT_TOKEN_MAX_CHARS));
const ASCII_SPACE = 32;
const ASCII_DELETE = 127;
const RESERVED_BRANCH_NAMES: ReadonlySet<string> = new Set(['@', 'HEAD']);
const INVALID_MOUNT_SEGMENTS: ReadonlySet<string> = new Set(['', '.', '..', '.git']);
export const GIT_PURPOSE = 'mechane.managed-session.git.v1';
const GIT_URL_PATH = /^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const COMMIT_SHA = /^[a-f0-9]{7,64}$/i;

export async function validateSessionVaults(
  context: StoreContext,
  scope: ManagedScope,
  value: unknown,
): Promise<ReadonlyArray<string>> {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Schema.is(Schema.Array(StoredText))(value)) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid vault_ids');
  }

  for (const id of [...new Set(value)].toSorted()) {
    const vault = await requireVault(context, { scope, vaultId: id, lockClause: 'FOR SHARE' });

    if (vault.archived_at !== null) {
      throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Cannot attach an archived vault');
    }
  }

  return value;
}

type PrepareResources = {
  readonly context: StoreContext;
  readonly keyring: CredentialKeyring;
  readonly scope: ManagedScope;
  readonly sessionId: string;
  readonly resources?: unknown;
  readonly allowedGitHostnames?: ReadonlyArray<string>;
};

type GitToken = {
  readonly workspaceId: string;
  readonly sessionId: string;
  readonly resourceId: string;
  readonly url: string;
  readonly token: unknown;
};

async function saveGitToken(context: StoreContext, keyring: CredentialKeyring, input: GitToken) {
  if (!Schema.is(GitAuthorizationToken)(input.token) || /[\r\n]/.test(input.token)) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid authorization_token');
  }

  const reference = JSON.stringify([input.sessionId, input.resourceId, input.url]);

  const encrypted = await encryptCredential(
    { workspaceId: input.workspaceId, reference, purpose: GIT_PURPOSE },
    keyring,
    Redacted.make(input.token),
  );

  await context.client.query(
    `INSERT INTO mechane.managed_session_git_tokens(workspace_id,session_id,resource_id,url,key_version,nonce,ciphertext)
    VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(session_id,resource_id) DO UPDATE SET
    key_version=excluded.key_version,nonce=excluded.nonce,ciphertext=excluded.ciphertext`,
    [
      input.workspaceId,
      input.sessionId,
      input.resourceId,
      input.url,
      encrypted.keyVersion,
      encrypted.nonce,
      encrypted.ciphertext,
    ],
  );
}

function isBranchName(name: string): boolean {
  const reserved = name.length === 0 || name.length > BRANCH_NAME_MAX_CHARS || RESERVED_BRANCH_NAMES.has(name);
  const invalidBoundary = name.startsWith('-') || name.endsWith('.');
  const invalidSequence = name.includes('..') || name.includes('@{');

  if (reserved || invalidBoundary || invalidSequence) {
    return false;
  }

  const forbidden = new Set(['~', '^', ':', '?', '*', '[', '\\']);

  for (const char of name) {
    const code = char.codePointAt(0) ?? 0;

    if (code <= ASCII_SPACE || code === ASCII_DELETE || forbidden.has(char)) {
      return false;
    }
  }

  return name.split('/').every((part) => part.length > 0 && !part.startsWith('.') && !part.endsWith('.lock'));
}

function checkedCheckout(value: unknown): ManagedDocument | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (!Schema.is(ResourceDocument)(value)) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid Git checkout');
  }

  if (value['type'] === 'branch' && typeof value['name'] === 'string' && isBranchName(value['name'])) {
    return { type: 'branch', name: value['name'] };
  }

  if (value['type'] === 'commit' && typeof value['sha'] === 'string' && COMMIT_SHA.test(value['sha'])) {
    return { type: 'commit', sha: value['sha'] };
  }

  throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid Git checkout');
}

function isGitMountPath(value: string): boolean {
  if (value.length > MOUNT_PATH_MAX_CHARS || !value.startsWith('/workspace/')) {
    return false;
  }

  if (value.includes('\\') || value.includes('\0')) {
    return false;
  }

  return value
    .split('/')
    .slice(1)
    .every((part) => !INVALID_MOUNT_SEGMENTS.has(part.toLowerCase()));
}

async function prepareRepository(input: PrepareResources, body: ManagedDocument) {
  if (input.allowedGitHostnames === undefined || input.allowedGitHostnames.length === 0) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Git repository mounts are disabled');
  }

  const url = body['url'];

  if (typeof url !== 'string' || url.length > REPOSITORY_URL_MAX_CHARS || !URL.canParse(url)) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid Git repository URL');
  }

  const parsed = new URL(url);

  const hasExtraFields = [parsed.username, parsed.password, parsed.hash, parsed.search].some(
    (field) => field.length > 0,
  );

  const canonicalHttps = parsed.protocol === 'https:' && parsed.href === url;
  const repositoryPath = GIT_URL_PATH.test(parsed.pathname) && !parsed.pathname.endsWith('.git');

  if (hasExtraFields || !canonicalHttps || !repositoryPath) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid Git repository URL');
  }

  if (!input.allowedGitHostnames.includes(parsed.host)) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Git repository host is not allowed');
  }

  const mountPath = body['mount_path'] ?? posix.join('/workspace', posix.basename(parsed.pathname));

  if (typeof mountPath !== 'string' || !isGitMountPath(mountPath)) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid Git mount path');
  }

  const id = managedId('sesrsc');
  const now = new Date().toISOString();
  const checkout = checkedCheckout(body['checkout']);

  if (body['authorization_token'] !== undefined) {
    await saveGitToken(input.context, input.keyring, {
      workspaceId: input.scope.workspaceId,
      sessionId: input.sessionId,
      resourceId: id,
      url,
      token: body['authorization_token'],
    });
  }

  return { type: 'github_repository', id, created_at: now, updated_at: now, url, mount_path: mountPath, checkout };
}

export async function prepareSessionResources(input: PrepareResources): Promise<ReadonlyArray<ManagedDocument>> {
  if (input.resources === undefined || input.resources === null) {
    return [];
  }

  if (!Schema.is(Schema.Array(ResourceDocument))(input.resources)) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid resources');
  }

  const mounts = new Set<string>();
  const result: Array<ManagedDocument> = [];
  const stores = input.resources.filter((body) => body['type'] === 'memory_store');

  if (stores.length > MEMORY_MAX_MOUNTS) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Too many memory stores');
  }

  for (const body of input.resources) {
    const resolved = await prepareMount(input, body);
    const key = canonicalMountKey(resolved.mount_path);

    if (mounts.has(key)) {
      throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Duplicate resource mount path');
    }

    mounts.add(key);
    result.push(resolved);
  }

  return result;
}

async function prepareMount(input: PrepareResources, body: ManagedDocument) {
  if (body['type'] === 'github_repository') {
    return await prepareRepository(input, body);
  }

  if (body['type'] === 'file') {
    return await resolveFileMount({
      context: input.context,
      scope: input.scope,
      fileId: body['file_id'],
      mountPath: body['mount_path'],
    });
  }

  if (body['type'] !== 'memory_store') {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Unsupported session resource');
  }

  const storeId = body['memory_store_id'];

  if (typeof storeId !== 'string') {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid memory_store_id');
  }

  return await resolveMemoryMount({
    context: input.context,
    scope: input.scope,
    storeId,
    access: body['access'],
    instructions: body['instructions'],
  });
}

type SessionResourceMutation = { readonly scope: ManagedScope; readonly sessionId: string };

const MutableSessionResources = Schema.Struct({
  status: StoredText,
  archived_at: Schema.NullOr(StoredText),
  resources: Schema.Array(ResourceDocument),
});

async function lockMutableSessionResources(transaction: StoreContext, { scope, sessionId }: SessionResourceMutation) {
  const result = await transaction.client.query(
    `SELECT status,archived_at,configuration->'resources' AS resources FROM mechane.managed_sessions
     WHERE workspace_id=$1 AND (creator_id=$2 OR $3) AND id=$4 FOR UPDATE`,
    [scope.workspaceId, scope.principalId, scope.isAdmin, sessionId],
  );

  if (result.rowCount === 0) {
    throw new ManagedStoreError(HttpStatusCode.NotFound, 'Session not found');
  }

  const row = Schema.decodeUnknownSync(MutableSessionResources)(result.rows[0]);

  if (row.archived_at !== null || row.status === 'terminated') {
    throw new ManagedStoreError(
      HttpStatusCode.Conflict,
      'Cannot modify resources on an archived or terminated session',
    );
  }

  return row.resources;
}

async function replaceSessionResources(
  transaction: StoreContext,
  target: { readonly workspaceId: string; readonly sessionId: string },
  resources: ReadonlyArray<ManagedDocument>,
): Promise<void> {
  await transaction.client.query(
    `UPDATE mechane.managed_sessions
        SET configuration=jsonb_set(configuration,'{resources}',$3::jsonb),updated_at=now()
      WHERE workspace_id=$1 AND id=$2`,
    [target.workspaceId, target.sessionId, JSON.stringify(resources)],
  );
}

export async function addSessionFileResource(
  context: StoreContext,
  { scope, sessionId, body }: SessionResourceMutation & { readonly body: ManagedDocument },
) {
  return await context.atomic(async (transaction) => {
    const resources = await lockMutableSessionResources(transaction, { scope, sessionId });

    if (body['type'] !== 'file') {
      throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Only file resources can be added to an existing session');
    }

    const resolved = await resolveFileMount({
      context: transaction,
      scope,
      fileId: body['file_id'],
      mountPath: body['mount_path'],
    });

    const targetKey = canonicalMountKey(resolved.mount_path);

    for (const existing of resources) {
      const mountPath = existing['mount_path'];

      if (typeof mountPath === 'string' && canonicalMountKey(mountPath) === targetKey) {
        throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Duplicate resource mount path');
      }
    }

    await replaceSessionResources(transaction, { workspaceId: scope.workspaceId, sessionId }, [...resources, resolved]);

    return resolved;
  });
}

function findSessionResource(resources: ReadonlyArray<ManagedDocument>, resourceId: string) {
  const position = resources.findIndex(
    (attachment) => attachment['id'] === resourceId || attachment['memory_store_id'] === resourceId,
  );

  const resource = resources[position];

  if (resource === undefined) {
    throw new ManagedStoreError(HttpStatusCode.NotFound, 'Session resource not found');
  }

  return { position, resource };
}

export async function deleteSessionFileResource(
  context: StoreContext,
  { scope, sessionId, resourceId }: SessionResourceMutation & { readonly resourceId: string },
) {
  return await context.atomic(async (transaction) => {
    const resources = await lockMutableSessionResources(transaction, { scope, sessionId });
    const { position, resource } = findSessionResource(resources, resourceId);

    if (resource['type'] !== 'file') {
      throw new ManagedStoreError(
        HttpStatusCode.BadRequest,
        'Repository and memory resources are mounted for the session lifetime',
      );
    }

    const remaining = [...resources.slice(0, position), ...resources.slice(position + 1)];

    await replaceSessionResources(transaction, { workspaceId: scope.workspaceId, sessionId }, remaining);

    return { type: 'session_resource_deleted' as const, id: resourceId };
  });
}

export type GitRotation = {
  readonly scope: ManagedScope;
  readonly sessionId: string;
  readonly resourceId: string;
  readonly body: ManagedDocument;
};

export async function rotateGitResourceCredential(
  context: StoreContext,
  keyring: CredentialKeyring,
  { scope, sessionId, resourceId, body }: GitRotation,
) {
  return await context.atomic(async (transaction) => {
    const result = await transaction.client.query(
      `SELECT configuration->'resources' AS resources FROM mechane.managed_sessions
      WHERE workspace_id=$1 AND (creator_id=$2 OR $3) AND id=$4 FOR UPDATE`,
      [scope.workspaceId, scope.principalId, scope.isAdmin, sessionId],
    );

    if (result.rowCount === 0) {
      throw new ManagedStoreError(HttpStatusCode.NotFound, 'Session not found');
    }

    const { resources } = Schema.decodeUnknownSync(Schema.Struct({ resources: Schema.Array(ResourceDocument) }))(
      result.rows[0],
    );

    const { position, resource } = findSessionResource(resources, resourceId);

    const url = resource['url'];

    if (resource['type'] !== 'github_repository' || typeof url !== 'string') {
      throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Only Git resources support token rotation');
    }

    await saveGitToken(transaction, keyring, {
      workspaceId: scope.workspaceId,
      sessionId,
      resourceId,
      url,
      token: body['authorization_token'],
    });

    const updated = { ...resource, updated_at: new Date().toISOString() };

    await transaction.client.query(
      `UPDATE mechane.managed_sessions SET configuration=jsonb_set(configuration,ARRAY['resources',$3::text],$4::jsonb) WHERE workspace_id=$1 AND id=$2`,
      [scope.workspaceId, sessionId, position, updated],
    );

    return updated;
  });
}
