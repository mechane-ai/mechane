import { decodePage, encodePage, managedId, ManagedStoreError, pageSize } from '@mechane/authority-store';
import type { ManagedDocument, ManagedScope, StoreContext } from '@mechane/authority-store';
import { HttpStatusCode } from '@mechane/records';
import type { Buffer } from 'node:buffer';

type ManagedFileMetadata = ManagedDocument & {
  readonly id: string;
  readonly filename: string;
  readonly mime_type: string;
  readonly size_bytes: number;
  readonly created_at: string;
};

type ManagedFilesPage = { readonly data: ReadonlyArray<ManagedFileMetadata>; readonly next_page: string | null };

type FileCreate = {
  readonly scope: ManagedScope;
  readonly id?: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly r2Key: string | null;
  readonly content: Uint8Array | null;
  readonly expiresAt: string | null;
  readonly scopeId?: string | null;
};

type FileTarget = { readonly scope: ManagedScope; readonly fileId: string };

type FileList = {
  readonly scope: ManagedScope;
  readonly page?: string;
  readonly maxRows?: number;
  readonly ids?: ReadonlyArray<string>;
  readonly scopeId?: string;
};

type SessionFileTarget = {
  readonly workspaceId: string;
  readonly sessionId: string;
  readonly leaseId: string;
  readonly fileId: string;
  readonly includeContent: boolean;
};

type FileMountInput = {
  readonly context: StoreContext;
  readonly scope: ManagedScope;
  readonly fileId: unknown;
  readonly mountPath: unknown;
};

type ManagedFileResource = {
  readonly type: 'file';
  readonly id: string;
  readonly file_id: string;
  readonly mount_path: string;
  readonly created_at: string;
  readonly updated_at: string;
};

const FILE_PAGE_MAX_ROWS = 1000;
const FILE_IDS_MAX_COUNT = 100;
const FILE_ID_MAX_CHARS = 128;
const FILE_FILENAME_MAX_CHARS = 500;
const FILE_MIME_TYPE_MAX_CHARS = 255;
const MOUNT_PATH_MAX_CHARS = 4096;
const ASCII_SPACE = 32;
const ASCII_DELETE = 127;
const PAGE_CURSOR_PREFIX = 'page_';
const WORKSPACE_PREFIX = '/workspace/';
const SESSION_MNT_PREFIX = '/mnt/session/';
const RESERVED_SEGMENTS: ReadonlySet<string> = new Set(['', '.', '..', '.git']);

const VISIBLE_FILE =
  'f.workspace_id=$1 AND (f.creator_id=$2 OR $3) AND f.deleted_at IS NULL AND (f.expires_at IS NULL OR f.expires_at>clock_timestamp())';

const FILE_COLUMNS = `f.id,'file' AS type,f.filename,f.mime_type,f.size_bytes::float8 AS size_bytes,f.created_at,f.downloadable,f.expires_at,
  CASE WHEN f.scope_id IS NOT NULL THEN jsonb_build_object('id',f.scope_id,'type',f.scope_type) ELSE NULL END AS scope`;

function scopeValues(scope: ManagedScope): readonly [string, string, boolean] {
  return [scope.workspaceId, scope.principalId, scope.isAdmin];
}

function firstFile<Entry>(rows: ReadonlyArray<Entry>): Entry {
  const entry = rows[0];

  if (entry === undefined) {
    throw new ManagedStoreError(HttpStatusCode.NotFound, 'File not found');
  }

  return entry;
}

function decodeFilePage(page?: string) {
  if (page === undefined) {
    return null;
  }

  if (!page.startsWith(PAGE_CURSOR_PREFIX)) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid pagination cursor');
  }

  return decodePage(page.slice(PAGE_CURSOR_PREFIX.length));
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;

    if (code < ASCII_SPACE || code === ASCII_DELETE) {
      return true;
    }
  }

  return false;
}

export function canonicalMountKey(mountPath: string): string {
  if (mountPath.startsWith(WORKSPACE_PREFIX)) {
    return mountPath.slice(WORKSPACE_PREFIX.length);
  }

  if (mountPath.startsWith(SESSION_MNT_PREFIX)) {
    return mountPath.slice(SESSION_MNT_PREFIX.length);
  }

  if (mountPath.startsWith('/')) {
    return mountPath.slice(1);
  }

  return mountPath;
}

function isFileMountPath(value: string): boolean {
  if (value.length === 0 || value.length > MOUNT_PATH_MAX_CHARS || !value.startsWith('/')) {
    return false;
  }

  if (value.includes('\\') || value.includes('\0') || hasControlCharacter(value)) {
    return false;
  }

  const relative = canonicalMountKey(value);

  if (relative.length === 0) {
    return false;
  }

  const segments = relative.split('/');

  return segments.length > 0 && segments.every((segment) => !RESERVED_SEGMENTS.has(segment.toLowerCase()));
}

function defaultMountFilename(filename: string, fileId: string): string {
  const trimmed = filename.trim();
  const hasSeparator = trimmed.includes('/') || trimmed.includes('\\');
  const isReserved = trimmed.length === 0 || RESERVED_SEGMENTS.has(trimmed.toLowerCase());

  if (hasSeparator || isReserved || hasControlCharacter(trimmed)) {
    return fileId;
  }

  return trimmed;
}

export async function resolveFileMount({
  context,
  scope,
  fileId,
  mountPath,
}: FileMountInput): Promise<ManagedFileResource> {
  if (typeof fileId !== 'string' || fileId.length === 0 || fileId.length > FILE_ID_MAX_CHARS) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid file_id');
  }

  const result = await context.client.query<{ readonly id: string; readonly filename: string }>(
    `SELECT f.id,f.filename FROM mechane.managed_files f WHERE ${VISIBLE_FILE} AND f.id=$4 FOR SHARE OF f`,
    [...scopeValues(scope), fileId],
  );

  const file = firstFile(result.rows);
  const resolvedMount = mountPath ?? `${WORKSPACE_PREFIX}uploads/${defaultMountFilename(file.filename, file.id)}`;

  if (typeof resolvedMount !== 'string' || !isFileMountPath(resolvedMount)) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid file mount path');
  }

  const now = new Date().toISOString();

  return {
    type: 'file',
    id: managedId('sesrsc'),
    file_id: file.id,
    mount_path: resolvedMount,
    created_at: now,
    updated_at: now,
  };
}

function filePageLimit(maxRows?: number): number {
  if (maxRows === undefined) {
    return pageSize({}, FILE_PAGE_MAX_ROWS);
  }

  return pageSize({ maxRows }, FILE_PAGE_MAX_ROWS);
}

function fileScopeType(scopeId: string | null): string | null {
  if (scopeId === null) {
    return null;
  }

  return 'session';
}

export function createManagedFileStore(context: StoreContext) {
  return {
    async create(input: FileCreate): Promise<ManagedFileMetadata> {
      const { scope, filename, mimeType, sizeBytes, sha256, r2Key, content, expiresAt, scopeId = null } = input;

      if (filename.length === 0 || filename.length > FILE_FILENAME_MAX_CHARS) {
        throw new ManagedStoreError(HttpStatusCode.BadRequest, 'File name must be 1 to 500 characters');
      }

      if (mimeType.length === 0 || mimeType.length > FILE_MIME_TYPE_MAX_CHARS) {
        throw new ManagedStoreError(HttpStatusCode.BadRequest, 'MIME type must be 1 to 255 characters');
      }

      if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
        throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid file size');
      }

      const id = input.id ?? managedId('file');
      const scopeType = fileScopeType(scopeId);

      const result = await context.client.query<ManagedFileMetadata>(
        `INSERT INTO mechane.managed_files AS f
           (id,workspace_id,creator_id,filename,mime_type,size_bytes,sha256,downloadable,r2_key,content,scope_type,scope_id,expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,$9,$10,$11,$12)
         RETURNING ${FILE_COLUMNS}`,
        [
          id,
          scope.workspaceId,
          scope.principalId,
          filename,
          mimeType,
          sizeBytes,
          sha256,
          r2Key,
          content,
          scopeType,
          scopeId,
          expiresAt,
        ],
      );

      return firstFile(result.rows);
    },
    async get({ scope, fileId }: FileTarget): Promise<ManagedFileMetadata> {
      const result = await context.client.query<ManagedFileMetadata>(
        `SELECT ${FILE_COLUMNS} FROM mechane.managed_files f WHERE ${VISIBLE_FILE} AND f.id=$4`,
        [...scopeValues(scope), fileId],
      );

      return firstFile(result.rows);
    },
    async list({ scope, page, maxRows, ids, scopeId }: FileList): Promise<ManagedFilesPage> {
      if (ids !== undefined) {
        if (page !== undefined || maxRows !== undefined) {
          throw new ManagedStoreError(HttpStatusCode.BadRequest, 'ids cannot be combined with page or limit');
        }

        const uniqueIds = [...new Set(ids)];

        if (uniqueIds.length > FILE_IDS_MAX_COUNT) {
          throw new ManagedStoreError(HttpStatusCode.BadRequest, 'At most 100 unique file IDs may be requested');
        }

        if (uniqueIds.length === 0) {
          return { data: [], next_page: null };
        }

        const result = await context.client.query<ManagedFileMetadata>(
          `SELECT ${FILE_COLUMNS} FROM mechane.managed_files f
            WHERE ${VISIBLE_FILE} AND f.id=ANY($4::text[]) AND ($5::text IS NULL OR f.scope_id=$5)
            ORDER BY f.created_at DESC,f.id DESC`,
          [...scopeValues(scope), uniqueIds, scopeId ?? null],
        );

        return { data: result.rows, next_page: null };
      }

      const limit = filePageLimit(maxRows);
      const cursor = decodeFilePage(page);

      const result = await context.client.query<ManagedFileMetadata>(
        `SELECT ${FILE_COLUMNS} FROM mechane.managed_files f
          WHERE ${VISIBLE_FILE}
            AND ($4::text IS NULL OR f.scope_id=$4)
            AND ($5::timestamptz IS NULL OR (f.created_at,f.id)<($5::timestamptz,$6::text))
          ORDER BY f.created_at DESC,f.id DESC LIMIT $7`,
        [...scopeValues(scope), scopeId ?? null, cursor?.createdAt ?? null, cursor?.id ?? null, limit + 1],
      );

      const entries = result.rows.slice(0, limit);
      const last = entries.at(-1);

      if (result.rows.length > limit && last !== undefined) {
        return {
          data: entries,
          next_page: `${PAGE_CURSOR_PREFIX}${encodePage({ createdAt: last.created_at, id: last.id })}`,
        };
      }

      return { data: entries, next_page: null };
    },
    async content({ scope, fileId }: FileTarget) {
      const result = await context.client.query<{
        readonly filename: string;
        readonly mime_type: string;
        readonly size_bytes: number;
        readonly isDownloadable: boolean;
        readonly r2_key: string | null;
        readonly content: Buffer | null;
      }>(
        `SELECT f.filename,f.mime_type,f.size_bytes::float8 AS size_bytes,f.downloadable AS "isDownloadable",f.r2_key,f.content
           FROM mechane.managed_files f WHERE ${VISIBLE_FILE} AND f.id=$4`,
        [...scopeValues(scope), fileId],
      );

      const row = firstFile(result.rows);

      if (!row.isDownloadable) {
        throw new ManagedStoreError(HttpStatusCode.BadRequest, 'File is not downloadable');
      }

      return {
        filename: row.filename,
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes,
        r2Key: row.r2_key,
        content: row.content,
      };
    },
    async sessionFile({ workspaceId, sessionId, leaseId, fileId, includeContent }: SessionFileTarget) {
      const result = await context.client.query<
        ManagedFileMetadata & {
          readonly isDownloadable: boolean;
          readonly r2_key: string | null;
          readonly content: Buffer | null;
        }
      >(
        `SELECT ${FILE_COLUMNS}, f.downloadable AS "isDownloadable", f.r2_key, CASE WHEN $5 THEN f.content ELSE NULL END AS content
           FROM mechane.managed_sessions sess
           JOIN mechane.managed_files f ON f.workspace_id=sess.workspace_id AND f.id=$3
           JOIN mechane.managed_work w ON w.workspace_id=sess.workspace_id AND w.session_id=sess.id
          WHERE sess.id=$2 AND sess.workspace_id=$1 AND sess.archived_at IS NULL AND sess.status<>'terminated'
            AND f.deleted_at IS NULL AND (f.expires_at IS NULL OR f.expires_at>clock_timestamp())
            AND w.lease_id=$4 AND w.state IN ('starting','active','stopping') AND w.lease_until>clock_timestamp()
            AND sess.configuration->'resources' @> jsonb_build_array(jsonb_build_object('type','file','file_id',f.id))`,
        [workspaceId, sessionId, fileId, leaseId, includeContent],
      );

      const { isDownloadable, r2_key: r2Key, content, ...record } = firstFile(result.rows);

      if (includeContent && !isDownloadable) {
        throw new ManagedStoreError(HttpStatusCode.BadRequest, 'File is not downloadable');
      }

      return { record, r2Key, content };
    },
    async delete({ scope, fileId }: FileTarget) {
      const result = await context.client.query<{ readonly id: string; readonly r2_key: string | null }>(
        `UPDATE mechane.managed_files f SET deleted_at=now(),content=NULL
          WHERE ${VISIBLE_FILE} AND f.id=$4
          RETURNING f.id,f.r2_key`,
        [...scopeValues(scope), fileId],
      );

      const row = firstFile(result.rows);

      return { id: row.id, type: 'file_deleted' as const, r2Key: row.r2_key };
    },
  };
}
